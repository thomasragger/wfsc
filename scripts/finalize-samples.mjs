/**
 * Finalize the new sample books:
 *   1. Letter each sample's title onto its cover (integrated into the art, with
 *      the per-style colour rule — crayon = playful, everything else = unified),
 *      then flag cover_has_title so the viewer stops printing a duplicate title.
 *   2. Photograph the titled cover as a 3D book mockup (the default tile view).
 *   3. Prune the previous generation of samples.
 *
 * "New" = is_sample books created on/after CUTOFF. Resumable (guards on
 * cover_has_title / mockup_image_url).
 * Run: node --env-file=.env scripts/finalize-samples.mjs
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';

const CUTOFF = '2026-07-09'; // new samples were regenerated on this date
const TMP = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : '/tmp';
const MOCKUP_REF_DIR = '/Users/thomasragger/Desktop/personal-lab/wfsc-website/archive/book-mockups';
const MOCKUP_REF_FILES = [
  'Gemini_Generated_Image_aeutghaeutghaeut.png',
  'Gemini_Generated_Image_txk4yhtxk4yhtxk4.png',
];

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const replicate = new Replicate();
await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

const mockupRefUrls = [];
for (const file of MOCKUP_REF_FILES) {
  const bytes = await readFile(`${MOCKUP_REF_DIR}/${file}`);
  const path = `style-refs/book-mockup/${file}`;
  const { error } = await db.storage.from('renders').upload(path, bytes, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`ref upload: ${error.message}`);
  mockupRefUrls.push(db.storage.from('renders').getPublicUrl(path).data.publicUrl);
}

const toUrl = (o) => (typeof o === 'string' ? o : Array.isArray(o) ? String(o[0]) : String(o.url?.() ?? o.url));
const fetchBytes = async (url) => Buffer.from(await (await fetch(url)).arrayBuffer());
async function toJpeg(raw, tag, width) {
  const tin = `${TMP}/${tag}.png`, tout = `${TMP}/${tag}.jpg`;
  await writeFile(tin, raw);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', '--resampleWidth', String(width), tin, '--out', tout]);
  const out = await readFile(tout);
  await unlink(tin).catch(() => {});
  await unlink(tout).catch(() => {});
  return out;
}
function colorText(styleId) {
  return styleId === 'crayon'
    ? "Colour the lettering playfully like a child's crayon drawing — letters may be different bright colours."
    : "Use a SINGLE unified colour for the entire title, drawn from the artwork's palette. Do NOT colour individual letters or words differently; at most the colour may change once per line break. The whole headline should read as one cohesive piece of lettering.";
}

const { data: samples, error } = await db
  .from('books')
  .select('id, title, cover_image_url, style_id, cover_has_title, mockup_image_url, created_at')
  .eq('is_sample', true)
  .gte('created_at', CUTOFF)
  .order('created_at');
if (error) throw error;
console.log(`▸ finalizing ${samples.length} new samples…`);

for (const b of samples) {
  try {
    // 1. Letter the title onto the cover.
    if (!b.cover_has_title && b.cover_image_url) {
      const prompt =
        `Add the book title to this children's picture-book cover, integrated naturally into the illustration as though painted as part of the scene — NOT a caption in a blank band. ` +
        `Render it as large hand-lettering in the SAME art medium and texture as the artwork, across the top of the composition, letting background elements weave around the letters, with a few small decorative flourishes tying it into the picture. ` +
        `${colorText(b.style_id)} ` +
        `The title MUST read EXACTLY, letter-for-letter: "${b.title}" — do not invent, rename, shorten, translate or add words. ` +
        `Arrange the words in natural reading order so the whole title reads as one continuous phrase, left-to-right then top-to-bottom; never scatter the words out of order. ` +
        `Keep the characters, colours, framing and composition intact; only add the integrated title lettering, clearly legible.`;
      const out = await replicate.run('google/nano-banana-pro', {
        input: { prompt, image_input: [b.cover_image_url], aspect_ratio: '1:1', output_format: 'png' },
      });
      const jpeg = await toJpeg(await fetchBytes(toUrl(out)), `sc-${b.id}`, 1100);
      const path = `sample-covers-titled/${b.id}.jpg`;
      const { error: e1 } = await db.storage.from('renders').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
      if (e1) throw new Error(`cover upload: ${e1.message}`);
      b.cover_image_url = db.storage.from('renders').getPublicUrl(path).data.publicUrl;
      b.mockup_image_url = null; // cover changed → rebuild mockup
      await db.from('books').update({ cover_image_url: b.cover_image_url, cover_has_title: true }).eq('id', b.id);
      console.log(`  ✓ ${b.title} — titled cover`);
    }

    // 2. Build the 3D mockup from the titled cover.
    if (!b.mockup_image_url && b.cover_image_url) {
      const prompt =
        "Recreate this exact children's book cover illustration as a professional product photograph: a real square hardcover book at a gentle 3/4 angle on a warm beige studio backdrop, spine on the left, soft realistic shadow, subtle page edges, natural studio lighting. Match the photographic style, angle, backdrop and lighting of the two reference photos exactly. Reproduce the cover artwork faithfully including the title lettering; do not redraw or reinterpret it.";
      const out = await replicate.run('google/nano-banana-pro', {
        input: { prompt, image_input: [b.cover_image_url, ...mockupRefUrls], aspect_ratio: '1:1', output_format: 'png' },
      });
      const jpeg = await toJpeg(await fetchBytes(toUrl(out)), `sm-${b.id}`, 900);
      const path = `sample-mockups/${b.id}.jpg`;
      const { error: e2 } = await db.storage.from('renders').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
      if (e2) throw new Error(`mockup upload: ${e2.message}`);
      const pub = db.storage.from('renders').getPublicUrl(path).data.publicUrl;
      await db.from('books').update({ mockup_image_url: pub }).eq('id', b.id);
      console.log(`  ✓ ${b.title} — mockup`);
    }
  } catch (err) {
    console.log(`  ✗ ${b.title}: ${String(err).slice(0, 140)}`);
  }
}

// 3. Prune the previous generation of samples (only if the new set is present).
if (samples.length >= 6) {
  const { data: old } = await db
    .from('books')
    .select('id, title')
    .eq('is_sample', true)
    .lt('created_at', CUTOFF);
  for (const o of old ?? []) {
    await db.from('books').delete().eq('id', o.id);
    console.log(`  – pruned old sample: ${o.title}`);
  }
} else {
  console.log(`  ! only ${samples.length} new samples — skipping prune of old ones for safety`);
}
console.log('Done finalizing samples.');
