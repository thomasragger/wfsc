/**
 * Generate a photographed 3D book mockup for every story-template preview, so
 * the "Start from a story" tiles can show the flat illustration at rest and
 * the real book on hover. Mirrors generate-book-mockups.mjs but for
 * story_templates.preview_image_url -> story_templates.mockup_image_url.
 * Output is compressed to JPEG inline (nano-banana emits ~4-6MB PNGs).
 *
 * Resumable: skips templates that already have a mockup_image_url.
 * Run: node --env-file=.env scripts/generate-template-mockups.mjs
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';

const REF_DIR = '/Users/thomasragger/Desktop/personal-lab/wfsc-website/archive/book-mockups';
const REF_FILES = ['Gemini_Generated_Image_aeutghaeutghaeut.png', 'Gemini_Generated_Image_txk4yhtxk4yhtxk4.png'];

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const replicate = new Replicate();

await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

// Upload the style references once.
const refUrls = [];
for (const file of REF_FILES) {
  const bytes = await readFile(`${REF_DIR}/${file}`);
  const path = `style-refs/book-mockup/${file}`;
  const { error } = await db.storage.from('renders').upload(path, bytes, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`ref upload: ${error.message}`);
  refUrls.push(db.storage.from('renders').getPublicUrl(path).data.publicUrl);
}
console.log('✓ style refs ready');

const { data: templates, error } = await db
  .from('story_templates')
  .select('id, title, preview_image_url')
  .not('preview_image_url', 'is', null)
  .is('mockup_image_url', null);
if (error) throw error;
console.log(`▸ generating ${templates.length} template mockups…`);

const prompt =
  'Recreate this exact children\'s book cover illustration as a professional product photograph: a real square hardcover book photographed at a gentle 3/4 angle on a warm beige studio backdrop, spine visible on the left, soft realistic shadow beneath, subtle page edges, natural studio lighting. Match the photographic style, angle, backdrop and lighting of the two reference photos exactly. Reproduce the cover artwork faithfully on the book prop; do not redraw or reinterpret it.';

for (const t of templates) {
  try {
    const output = await replicate.run('google/nano-banana-pro', {
      input: { prompt, image_input: [t.preview_image_url, ...refUrls], aspect_ratio: '1:1', output_format: 'png' },
    });
    const url = typeof output === 'string' ? output : Array.isArray(output) ? String(output[0]) : String(output.url?.() ?? output.url);
    const raw = Buffer.from(await (await fetch(url)).arrayBuffer());
    const tin = `/tmp/tm-${t.id}.png`, tout = `/tmp/tm-${t.id}.jpg`;
    await writeFile(tin, raw);
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '--resampleWidth', '800', tin, '--out', tout]);
    const opt = await readFile(tout);
    const path = `template-mockups/${t.id}.jpg`;
    const { error: upErr } = await db.storage.from('renders').upload(path, opt, { contentType: 'image/jpeg', upsert: true });
    if (upErr) throw new Error(upErr.message);
    const pub = db.storage.from('renders').getPublicUrl(path).data.publicUrl;
    await db.from('story_templates').update({ mockup_image_url: pub }).eq('id', t.id);
    await unlink(tin); await unlink(tout);
    console.log(`  ✓ ${t.id}: ${(opt.length / 1024).toFixed(0)}KB`);
  } catch (err) {
    console.log(`  ✗ ${t.id}: ${String(err).slice(0, 120)}`);
  }
}
console.log('Template mockups complete.');
