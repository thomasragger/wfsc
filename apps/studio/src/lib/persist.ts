import { supabaseAdmin } from './supabase';

const RENDER_BUCKET = 'renders';

/**
 * Copy a transient image URL (Replicate delivery URLs expire) into Supabase
 * Storage and return a permanent public URL. Idempotent per storage path.
 */
export async function persistImage(sourceUrl: string, path: string): Promise<string> {
  const db = supabaseAdmin();
  await db.storage.createBucket(RENDER_BUCKET, { public: true }).catch(() => undefined);

  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`persistImage fetch failed ${res.status}: ${sourceUrl}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'image/png';

  const { error } = await db.storage
    .from(RENDER_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`persistImage upload failed: ${error.message}`);

  const { data } = db.storage.from(RENDER_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
