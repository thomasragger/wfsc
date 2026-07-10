import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tmpDir, ensureStateDirs } from './paths.ts';

/** Normalize a Replicate output (string, array, or FileOutput) to a URL. */
export function toUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return String(output[0]);
  const o = output as { url?: (() => unknown) | unknown };
  const u = typeof o?.url === 'function' ? (o.url as () => unknown)() : o?.url;
  return String(u);
}

export async function fetchBytes(url: string): Promise<Buffer> {
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

/**
 * Compress a raw image buffer to a JPEG of the given width via macOS `sips`.
 * Intermediates land in the gitignored state dir, never /tmp.
 */
export async function toJpeg(raw: Buffer, tag: string, width: number, quality = 82): Promise<Buffer> {
  ensureStateDirs();
  const tin = join(tmpDir, `${tag}.png`);
  const tout = join(tmpDir, `${tag}.jpg`);
  await writeFile(tin, raw);
  execFileSync('sips', [
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', String(quality),
    '--resampleWidth', String(width),
    tin, '--out', tout,
  ]);
  const out = await readFile(tout);
  await unlink(tin).catch(() => {});
  await unlink(tout).catch(() => {});
  return out;
}

/** Upload bytes to a bucket and return the public URL. */
export async function upload(
  db: SupabaseClient,
  bucket: string,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const { error } = await db.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`${path}: ${error.message}`);
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
