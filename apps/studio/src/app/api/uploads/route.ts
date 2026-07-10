import { NextResponse } from "next/server";
import sharp from "sharp";

import {
  RATE_LIMIT_COPY,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import {
  UPLOADS_BUCKET,
  canonicalStorageUrl,
  ensurePrivateBucket,
  signUrl,
} from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 8000; // cap pixel width/height to bound model input
// Refuse to DECODE anything larger than this (a 10 MB PNG can decompress to
// hundreds of MB of raw pixels — a memory-exhaustion lever on serverless).
// 80 MP comfortably covers modern phone cameras (48-50 MP).
const MAX_INPUT_PIXELS = 80_000_000;

/**
 * Real image formats we accept, verified by decoding the bytes (not by the
 * client-supplied MIME header). sharp reports HEIC/HEIF as "heif".
 */
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);

/** Map the decoded input format to the re-encoded output (HEIC becomes JPEG). */
function outputFor(format: string): {
  contentType: string;
  ext: string;
  encode: (p: sharp.Sharp) => sharp.Sharp;
} {
  switch (format) {
    case "png":
      return { contentType: "image/png", ext: "png", encode: (p) => p.png() };
    case "webp":
      return { contentType: "image/webp", ext: "webp", encode: (p) => p.webp({ quality: 90 }) };
    case "jpeg":
    case "heif":
    default:
      return { contentType: "image/jpeg", ext: "jpg", encode: (p) => p.jpeg({ quality: 90 }) };
  }
}

/**
 * POST /api/uploads — multipart upload of a customer photo.
 * Stores the file in the PRIVATE 'uploads' bucket and returns a signed URL.
 * The signed URL doubles as the wizard's preview <img> src; on book creation
 * the server normalizes it back to the canonical (unsigned) form for storage.
 *
 * Hardening (O5): rate limited per IP; the real image type is verified by
 * decoding the bytes; pixel dimensions are capped; and the image is fully
 * re-encoded so EXIF metadata (including GPS from phone photos) is stripped
 * before anything is stored.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = await checkRateLimit("uploads-ip", ip);
    if (!limit.ok) {
      return rateLimitResponse(RATE_LIMIT_COPY.uploads, limit.retryAfter);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Send a 'file' field with an image" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are accepted" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large (max 10 MB)" }, { status: 400 });
    }

    const inputBytes = Buffer.from(await file.arrayBuffer());

    // Verify the real format by decoding, then re-encode to strip EXIF and cap
    // dimensions. If sharp cannot decode it, it is not an image we can trust.
    let format: string | undefined;
    try {
      // metadata() reads the header only (no full decode) — safe on bombs.
      const meta = await sharp(inputBytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
      if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS) {
        return NextResponse.json(
          { error: "That image has too many pixels. Please upload a regular photo." },
          { status: 400 },
        );
      }
      format = meta.format;
    } catch {
      return NextResponse.json(
        { error: "That file doesn't look like a valid image. Try a JPEG or PNG." },
        { status: 400 },
      );
    }
    if (!format || !ALLOWED_FORMATS.has(format)) {
      return NextResponse.json(
        { error: "Unsupported image type. Please upload a JPEG, PNG, WebP, or HEIC photo." },
        { status: 400 },
      );
    }

    const { contentType, ext, encode } = outputFor(format);
    let outputBytes: Buffer;
    try {
      // .rotate() bakes EXIF orientation before metadata is dropped; resize
      // caps dimensions; the encode step re-writes the file without metadata
      // (sharp drops all metadata by default).
      outputBytes = await encode(
        sharp(inputBytes, { limitInputPixels: MAX_INPUT_PIXELS })
          .rotate()
          .resize({
            width: MAX_DIMENSION,
            height: MAX_DIMENSION,
            fit: "inside",
            withoutEnlargement: true,
          }),
      ).toBuffer();
    } catch {
      return NextResponse.json(
        { error: "We couldn't process that image. Try a JPEG or PNG." },
        { status: 400 },
      );
    }

    await ensurePrivateBucket(UPLOADS_BUCKET);

    const path = `photos/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin()
      .storage.from(UPLOADS_BUCKET)
      .upload(path, outputBytes, { contentType, upsert: false });
    if (error) throw new Error(error.message);

    const url = await signUrl(canonicalStorageUrl(UPLOADS_BUCKET, path));
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
