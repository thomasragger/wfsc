/**
 * Give each sample book a visible "cast": for every character, a believable
 * input photo (what a customer would upload) + the generated character sheet,
 * so the sample page can show how a real person becomes a storybook character.
 *
 * Samples were built from text descriptions, so the "photo" is a synthetic,
 * clearly-illustrative snapshot generated from that description; the character
 * sheet is the real one produced during generation (local sheets/ dir).
 *
 * Resumable: skips a person already present in book_people.
 * Run: node --env-file=.env scripts/add-sample-cast.mjs
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';

const TMP = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : '/tmp';
const CFG = '/Users/thomasragger/Desktop/personal-lab/wfsc-website/wfsc/packages/pipeline/sample-configs';

// template id → sample config basename (the generated dir + config share it)
const TEMPLATE_TO_CFG = {
  'beach-treasure': 's-beach-treasure',
  'dads-tiny-toolbox-helper': 's-dads-toolbox',
  'whale-watching': 's-whale-watching',
  'golf-with-grandpa': 's-golf-grandpa',
  'grandmas-garden-of-seasons': 's-grandmas-garden',
  'rainy-day-fort': 's-rainy-day-fort',
};

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const replicate = new Replicate();
await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

const toUrl = (o) => (typeof o === 'string' ? o : Array.isArray(o) ? String(o[0]) : String(o.url?.() ?? o.url));
const fetchBytes = async (u) => Buffer.from(await (await fetch(u)).arrayBuffer());
async function toJpeg(raw, tag, w) {
  const i = `${TMP}/${tag}.png`, o = `${TMP}/${tag}.jpg`;
  await writeFile(i, raw);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '--resampleWidth', String(w), i, '--out', o]);
  const b = await readFile(o); await unlink(i).catch(() => {}); await unlink(o).catch(() => {}); return b;
}
async function up(path, bytes, ct) {
  const { error } = await db.storage.from('renders').upload(path, bytes, { contentType: ct, upsert: true });
  if (error) throw new Error(`${path}: ${error.message}`);
  return db.storage.from('renders').getPublicUrl(path).data.publicUrl;
}

const { data: samples } = await db
  .from('books')
  .select('id, title, template_id')
  .eq('is_sample', true)
  .gte('created_at', '2026-07-09');

for (const book of samples ?? []) {
  const cfgName = TEMPLATE_TO_CFG[book.template_id];
  if (!cfgName) { console.log(`- skip ${book.title} (no config map)`); continue; }
  const cfg = JSON.parse(await readFile(`${CFG}/${cfgName}.json`, 'utf8'));
  const { data: existing } = await db.from('book_people').select('name').eq('book_id', book.id);
  const have = new Set((existing ?? []).map((p) => p.name));

  for (const [i, person] of cfg.people.entries()) {
    if (have.has(person.name)) { console.log(`  · ${book.title} / ${person.name} (exists)`); continue; }
    try {
      // 1. Believable input photo from the description.
      const photoPrompt =
        `A warm, candid real-life photograph of ${person.appearance}. ` +
        `Natural soft lighting, plain simple background, gentle smile, looking toward the camera, ` +
        `everyday smartphone snapshot, photorealistic, head-and-shoulders.`;
      const pOut = await replicate.run('google/nano-banana-pro', {
        input: { prompt: photoPrompt, aspect_ratio: '1:1', output_format: 'png' },
      });
      const photoUrl = await up(
        `sample-cast/${book.id}/${person.name.toLowerCase()}-photo.jpg`,
        await toJpeg(await fetchBytes(toUrl(pOut)), `cast-p-${book.id}-${i}`, 700),
        'image/jpeg',
      );

      // 2. The real character sheet from generation.
      const sheetLocal = `${CFG}/generated-${cfgName}/sheets/${person.name.toLowerCase()}.png`;
      const sheetUrl = await up(
        `sample-cast/${book.id}/${person.name.toLowerCase()}-sheet.jpg`,
        await toJpeg(await readFile(sheetLocal), `cast-s-${book.id}-${i}`, 900),
        'image/jpeg',
      );

      await db.from('book_people').insert({
        book_id: book.id,
        name: person.name,
        role: person.role ?? null,
        photo_urls: [photoUrl],
        character_sheet_url: sheetUrl,
        character_description: person.appearance,
        approved: true,
        sort_order: i,
      });
      console.log(`  ✓ ${book.title} / ${person.name}`);
    } catch (err) {
      console.log(`  ✗ ${book.title} / ${person.name}: ${String(err).slice(0, 140)}`);
    }
  }
}
console.log('Done adding sample cast.');
