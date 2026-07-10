/**
 * Import a CLI-generated book as a public sample book.
 * Uploads local images to Supabase Storage and creates books/book_spreads rows
 * with is_sample = true.
 *
 * Run: node --env-file=.env scripts/import-sample-book.mjs <generated-dir> <category-or-slug> <template-id>
 * e.g. node --env-file=.env scripts/import-sample-book.mjs packages/pipeline/sample-configs/generated-mums mums beach-treasure
 */
import { createClient } from '@supabase/supabase-js';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [dirArg, slug, templateId] = process.argv.slice(2);
if (!dirArg || !slug) {
  console.error('Usage: import-sample-book.mjs <generated-dir> <slug> [template-id]');
  process.exit(1);
}
const dir = resolve(dirArg);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'renders';
await db.storage.createBucket(BUCKET, { public: true }).catch(() => undefined);

async function upload(localPath, storagePath) {
  const bytes = await readFile(localPath);
  const { error } = await db.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
  return db.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

const book = JSON.parse(await readFile(join(dir, 'book.json'), 'utf8'));

// Replace any existing sample with the same title (idempotent re-import).
const { data: existing } = await db
  .from('books')
  .select('id')
  .eq('is_sample', true)
  .eq('title', book.title);
for (const row of existing ?? []) {
  await db.from('books').delete().eq('id', row.id);
  console.log(`- replaced existing sample ${row.id}`);
}

// Unique storage prefix per book. Category slug alone collides when a category
// has more than one sample (a later import would overwrite an earlier one's
// images), so key on the unique template id, falling back to the slug.
const storageKey = templateId ?? slug;
const coverUrl = await upload(join(dir, 'spreads', 'cover.png'), `samples/${storageKey}/cover.png`);

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

const spreadFiles = (await readdir(join(dir, 'spreads'))).filter((f) => f.startsWith('spread-'));
for (const spread of book.spreads) {
  const file = spreadFiles.find((f) => f === `spread-${String(spread.position).padStart(2, '0')}.png`);
  const imageUrl = file
    ? await upload(join(dir, 'spreads', file), `samples/${storageKey}/${file}`)
    : null;
  const { error } = await db.from('book_spreads').insert({
    book_id: created.id,
    position: spread.position,
    kind: 'story',
    text: spread.text,
    layout: spread.layout,
    image_url: imageUrl,
  });
  if (error) throw error;
}

console.log(`✓ Sample "${book.title}" imported (${book.spreads.length} spreads)`);
console.log(`  token: ${created.access_token}`);
