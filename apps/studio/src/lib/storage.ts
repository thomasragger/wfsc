import { supabaseAdmin } from './supabase';

/**
 * Storage buckets, split by sensitivity:
 *
 * - `uploads` (PRIVATE) — customer-uploaded photos, usually of children.
 * - `book-assets` (PRIVATE) — everything generated for a customer book:
 *   character sheets, spread images, print upscales, print PDFs.
 * - `renders` (PUBLIC) — catalog + sample content only (style refs, template
 *   previews, sample books built from synthetic casts). Never real customers.
 *
 * Private assets are stored under their canonical URL (the `/object/public/`
 * form, used purely as a stable identifier) and converted to short-lived
 * signed URLs at the edge: payload serialization, PDF rendering, and any call
 * that hands a URL to an external fetcher (Replicate, Anthropic, Lulu).
 */

export const UPLOADS_BUCKET = 'uploads';
export const BOOK_ASSETS_BUCKET = 'book-assets';
export const CATALOG_BUCKET = 'renders';

/** Buckets whose objects must never be served without a signature. */
const PRIVATE_BUCKETS = new Set([UPLOADS_BUCKET, BOOK_ASSETS_BUCKET, 'print']);

/** Default signature lifetime: long enough for a review session, an Inngest
 *  run, or a Lulu download; page loads re-sign on every render. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

const ensuredBuckets = new Set<string>();

/** Create-if-missing, private. Ignores "already exists". */
export async function ensurePrivateBucket(bucket: string): Promise<void> {
  if (ensuredBuckets.has(bucket)) return;
  await supabaseAdmin()
    .storage.createBucket(bucket, { public: false })
    .catch(() => undefined);
  ensuredBuckets.add(bucket);
}

export interface StorageRef {
  bucket: string;
  path: string;
}

/**
 * Parse a Supabase Storage URL (public or signed form) into bucket + path.
 * Returns null for anything else (external hosts, data URIs, garbage).
 */
export function parseStorageUrl(url: string): StorageRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/** Stable identifier URL for a stored object (works verbatim for public buckets). */
export function canonicalStorageUrl(bucket: string, path: string): string {
  const base = process.env.SUPABASE_URL;
  if (!base) throw new Error('SUPABASE_URL not configured');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Convert a stored URL to something fetchable: private-bucket URLs get a
 * signature, everything else (public buckets, external URLs) passes through.
 */
export async function signUrl(
  url: string | null | undefined,
  ttlSeconds = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!url) return null;
  const ref = parseStorageUrl(url);
  if (!ref || !PRIVATE_BUCKETS.has(ref.bucket)) return url;
  const { data, error } = await supabaseAdmin()
    .storage.from(ref.bucket)
    .createSignedUrl(ref.path, ttlSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`signUrl failed for ${ref.bucket}/${ref.path}: ${error?.message}`);
  }
  return data.signedUrl;
}

/** Batch variant of signUrl; preserves order, groups by bucket. */
export async function signUrls(
  urls: (string | null | undefined)[],
  ttlSeconds = SIGNED_URL_TTL_SECONDS,
): Promise<(string | null)[]> {
  const out: (string | null)[] = urls.map((u) => u ?? null);
  const byBucket = new Map<string, { index: number; path: string }[]>();
  urls.forEach((url, index) => {
    if (!url) return;
    const ref = parseStorageUrl(url);
    if (!ref || !PRIVATE_BUCKETS.has(ref.bucket)) return;
    const group = byBucket.get(ref.bucket) ?? [];
    group.push({ index, path: ref.path });
    byBucket.set(ref.bucket, group);
  });
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, entries]) => {
      const { data, error } = await supabaseAdmin()
        .storage.from(bucket)
        .createSignedUrls(
          entries.map((e) => e.path),
          ttlSeconds,
        );
      if (error || !data) throw new Error(`signUrls failed for ${bucket}: ${error?.message}`);
      data.forEach((item, i) => {
        if (item.signedUrl) out[entries[i].index] = item.signedUrl;
      });
    }),
  );
  return out;
}

/** Recursively delete every object under a prefix. Best-effort on empty prefixes. */
export async function deleteStoragePrefix(bucket: string, prefix: string): Promise<void> {
  const db = supabaseAdmin();
  const paths: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const { data, error } = await db.storage.from(bucket).list(dir, { limit: 1000 });
    if (error || !data) return;
    for (const entry of data) {
      const full = dir ? `${dir}/${entry.name}` : entry.name;
      // Folders come back without an id; files have one.
      if (entry.id) paths.push(full);
      else await walk(full);
    }
  };
  await walk(prefix);
  if (paths.length > 0) {
    const { error } = await db.storage.from(bucket).remove(paths);
    if (error) throw new Error(`deleteStoragePrefix ${bucket}/${prefix}: ${error.message}`);
  }
}

/** Delete individual objects referenced by stored URLs (any bucket). */
export async function deleteStorageUrls(urls: (string | null | undefined)[]): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const url of urls) {
    if (!url) continue;
    const ref = parseStorageUrl(url);
    if (!ref) continue;
    byBucket.set(ref.bucket, [...(byBucket.get(ref.bucket) ?? []), ref.path]);
  }
  const db = supabaseAdmin();
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, paths]) => {
      const { error } = await db.storage.from(bucket).remove(paths);
      if (error) throw new Error(`deleteStorageUrls ${bucket}: ${error.message}`);
    }),
  );
}
