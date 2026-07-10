import { NextResponse } from "next/server";

import {
  UPLOADS_BUCKET,
  canonicalStorageUrl,
  ensurePrivateBucket,
  signUrl,
} from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/uploads — multipart upload of a customer photo.
 * Stores the file in the PRIVATE 'uploads' bucket and returns a signed URL.
 * The signed URL doubles as the wizard's preview <img> src; on book creation
 * the server normalizes it back to the canonical (unsigned) form for storage.
 */
export async function POST(request: Request) {
  try {
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

    await ensurePrivateBucket(UPLOADS_BUCKET);

    const ext =
      (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `photos/${crypto.randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error } = await supabaseAdmin()
      .storage.from(UPLOADS_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });
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
