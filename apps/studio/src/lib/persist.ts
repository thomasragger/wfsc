import {
  BOOK_ASSETS_BUCKET,
  canonicalStorageUrl,
  ensurePrivateBucket,
} from './storage';
import { supabaseAdmin } from './supabase';

/**
 * Copy a transient image URL (Replicate delivery URLs expire) into the
 * PRIVATE book-assets bucket and return its canonical URL (an identifier —
 * consumers sign it before serving or handing it to external fetchers).
 * Idempotent per storage path.
 */
export async function persistImage(sourceUrl: string, path: string): Promise<string> {
  await ensurePrivateBucket(BOOK_ASSETS_BUCKET);

  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`persistImage fetch failed ${res.status}: ${sourceUrl}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'image/png';

  const { error } = await supabaseAdmin()
    .storage.from(BOOK_ASSETS_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`persistImage upload failed: ${error.message}`);

  return canonicalStorageUrl(BOOK_ASSETS_BUCKET, path);
}
