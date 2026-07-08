/**
 * Generate a photorealistic 3D product-shot mockup for each sample book's
 * flat illustrated cover, using two reference style photos (warm beige
 * studio backdrop, slight 3/4 angle, visible spine, soft shadow) as the
 * style guide for nano-banana-pro. The flat cover_image_url stays the
 * source of truth for the actual page-turning viewer; mockup_image_url is
 * only used where a book needs to look like a real physical object.
 *
 * Run: node --env-file=.env scripts/generate-book-mockups.mjs
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { readFile } from 'node:fs/promises';

const REF_DIR = '/Users/thomasragger/Desktop/personal-lab/wfsc-website/archive/book-mockups';
const REF_FILES = ['Gemini_Generated_Image_aeutghaeutghaeut.png', 'Gemini_Generated_Image_txk4yhtxk4yhtxk4.png'];

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const replicate = new Replicate();

await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

// 1. Upload the two style references once, reuse their public URLs.
const refUrls = [];
for (const file of REF_FILES) {
  const bytes = await readFile(`${REF_DIR}/${file}`);
  const path = `style-refs/book-mockup/${file}`;
  const { error } = await db.storage.from('renders').upload(path, bytes, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`upload ${file}: ${error.message}`);
  refUrls.push(db.storage.from('renders').getPublicUrl(path).data.publicUrl);
}
console.log('✓ style references uploaded');

// 2. Generate a mockup for every sample book missing one.
const { data: books, error } = await db
  .from('books')
  .select('id, title, cover_image_url, template_id, story_templates(category_id)')
  .eq('is_sample', true)
  .is('mockup_image_url', null);
if (error) throw error;
console.log(`▸ generating ${books.length} book mockups…`);

for (const book of books) {
  if (!book.cover_image_url) {
    console.log(`  ✗ ${book.title}: no cover_image_url`);
    continue;
  }
  try {
    const prompt = `Recreate this exact children's book cover — same illustration, same title text, same characters, unchanged — as a professional product photograph: a real square hardcover book photographed at a gentle 3/4 angle on a warm beige studio backdrop, showing the book's spine on the left, soft realistic shadow beneath, subtle page edges visible, natural studio lighting. Match the photographic style, angle, backdrop color and lighting of the two reference photos exactly. Do not alter, redraw, or reinterpret the cover artwork or title — reproduce it faithfully on the book prop.`;
    const output = await replicate.run('google/nano-banana-pro', {
      input: {
        prompt,
        image_input: [book.cover_image_url, ...refUrls],
        aspect_ratio: '1:1',
        output_format: 'png',
      },
    });
    const url = typeof output === 'string' ? output : Array.isArray(output) ? String(output[0]) : String(output.url?.() ?? output.url);
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
    const category = book.story_templates?.category_id ?? book.id;
    const path = `samples/${category}/mockup.png`;
    const { error: upErr } = await db.storage.from('renders').upload(path, bytes, { contentType: 'image/png', upsert: true });
    if (upErr) throw new Error(upErr.message);
    const pub = db.storage.from('renders').getPublicUrl(path).data.publicUrl;
    await db.from('books').update({ mockup_image_url: pub }).eq('id', book.id);
    console.log(`  ✓ ${book.title}`);
  } catch (err) {
    console.log(`  ✗ ${book.title}: ${String(err).slice(0, 200)}`);
  }
}
console.log('Book mockup generation complete.');
