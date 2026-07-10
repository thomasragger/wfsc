import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { createDb } from '../lib/clients.ts';

interface SampleBookJson {
  title: string;
  greeting?: string;
  greetingFrom?: string;
  styleId: string;
  fontPairing?: string;
  spreads: { position: number; text: string; layout: string }[];
}

async function uploadPng(db: SupabaseClient, bucket: string, localPath: string, storagePath: string): Promise<string> {
  const bytes = await readFile(localPath);
  const { error } = await db.storage.from(bucket).upload(storagePath, bytes, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
  return db.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}

/** Import a CLI-generated book directory as a public sample book. */
export async function importSampleBook(
  db: SupabaseClient,
  generatedDir: string,
  slug: string,
  templateId?: string,
): Promise<void> {
  const dir = resolve(generatedDir);
  const BUCKET = 'renders';
  await db.storage.createBucket(BUCKET, { public: true }).catch(() => undefined);

  const book = JSON.parse(await readFile(join(dir, 'book.json'), 'utf8')) as SampleBookJson;

  // Replace any existing sample with the same title (idempotent re-import).
  const { data: existing } = await db.from('books').select('id').eq('is_sample', true).eq('title', book.title);
  for (const row of (existing ?? []) as { id: string }[]) {
    await db.from('books').delete().eq('id', row.id);
    console.log(`- replaced existing sample ${row.id}`);
  }

  // Unique storage prefix per book: key on template id, falling back to slug.
  const storageKey = templateId ?? slug;
  const coverUrl = await uploadPng(db, BUCKET, join(dir, 'spreads', 'cover.png'), `samples/${storageKey}/cover.png`);

  const { data: created, error: bookErr } = await db
    .from('books')
    .insert({
      is_sample: true,
      status: 'approved',
      title: book.title,
      greeting: book.greeting,
      greeting_from: book.greetingFrom ?? null,
      style_id: book.styleId,
      template_id: templateId ?? null,
      font_pairing: book.fontPairing ?? 'storybook',
      cover_image_url: coverUrl,
      memory_text: null,
    })
    .select('id, access_token')
    .single();
  if (bookErr) throw bookErr;
  const createdBook = created as { id: string; access_token: string };

  const spreadFiles = (await readdir(join(dir, 'spreads'))).filter((f) => f.startsWith('spread-'));
  for (const spread of book.spreads) {
    const file = spreadFiles.find((f) => f === `spread-${String(spread.position).padStart(2, '0')}.png`);
    const imageUrl = file ? await uploadPng(db, BUCKET, join(dir, 'spreads', file), `samples/${storageKey}/${file}`) : null;
    const { error } = await db.from('book_spreads').insert({
      book_id: createdBook.id,
      position: spread.position,
      kind: 'story',
      text: spread.text,
      layout: spread.layout,
      image_url: imageUrl,
    });
    if (error) throw error;
  }

  console.log(`✓ Sample "${book.title}" imported (${book.spreads.length} spreads)`);
  console.log(`  token: ${createdBook.access_token}`);
}

async function run(args: ParsedArgs): Promise<void> {
  const [dirArg, slug, templateId] = args.positionals;
  if (!dirArg || !slug) {
    throw new Error('Usage: import-sample <generated-dir> <slug> [template-id]');
  }
  const db = createDb();
  await importSampleBook(db, dirArg, slug, templateId);
}

export const importSample: Command = {
  name: 'import-sample',
  summary: 'Import a CLI-generated book directory as a public sample book.',
  usage: 'import-sample <generated-dir> <slug> [template-id]',
  run,
};
