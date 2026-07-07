import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const BUCKET = "uploads";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/uploads — multipart upload of a customer photo.
 * Stores the file in the public 'uploads' bucket (created on first use) and
 * returns its public URL.
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

    const db = supabaseAdmin();
    // Create-if-missing; ignore the "already exists" error on subsequent calls.
    await db.storage.createBucket(BUCKET, { public: true }).catch(() => undefined);

    const ext =
      (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `photos/${crypto.randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);

    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
