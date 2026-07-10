/**
 * Letter each story-template's title onto its preview illustration (the flat
 * covers were generated title-less with a reserved upper third), then rebuild
 * the 3D mockup from the titled preview — so both the at-rest tile and the
 * on-hover "real book" show an illustrated title, matching the sample books.
 *
 * For each template:
 *   1. img2img the existing preview_image_url, adding the exact title in
 *      charming hand-lettering in the reserved area (nano-banana-pro).
 *   2. Compress to JPEG (~900px), upload to template-previews-titled/, update
 *      story_templates.preview_image_url.
 *   3. Re-photograph the titled preview as a 3D book mockup, compress, upload
 *      to template-mockups/, update story_templates.mockup_image_url.
 *
 * Resumable: a progress file records each template's completed stages.
 * Run: node --env-file=.env scripts/letter-template-titles.mjs
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';

const TMP = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : '/tmp';
const PROGRESS = `${TMP}/letter-template-titles.json`;
const MOCKUP_REF_DIR = '/Users/thomasragger/Desktop/personal-lab/wfsc-website/archive/book-mockups';
const MOCKUP_REF_FILES = [
  'Gemini_Generated_Image_aeutghaeutghaeut.png',
  'Gemini_Generated_Image_txk4yhtxk4yhtxk4.png',
];

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const replicate = new Replicate();

await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

async function loadProgress() {
  try {
    return JSON.parse(await readFile(PROGRESS, 'utf8'));
  } catch {
    return { done: {} };
  }
}
let progress = await loadProgress();
const saveProgress = () => writeFile(PROGRESS, JSON.stringify(progress, null, 2));

// Upload the mockup style references once.
const mockupRefUrls = [];
for (const file of MOCKUP_REF_FILES) {
  const bytes = await readFile(`${MOCKUP_REF_DIR}/${file}`);
  const path = `style-refs/book-mockup/${file}`;
  const { error } = await db.storage.from('renders').upload(path, bytes, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`ref upload: ${error.message}`);
  mockupRefUrls.push(db.storage.from('renders').getPublicUrl(path).data.publicUrl);
}
console.log('✓ mockup refs ready');

const toUrl = (output) =>
  typeof output === 'string' ? output : Array.isArray(output) ? String(output[0]) : String(output.url?.() ?? output.url);

async function fetchBytes(url) {
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

/** Compress a PNG buffer to a JPEG of the given width and return the bytes. */
async function toJpeg(raw, tag, width) {
  const tin = `${TMP}/${tag}.png`;
  const tout = `${TMP}/${tag}.jpg`;
  await writeFile(tin, raw);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '--resampleWidth', String(width), tin, '--out', tout]);
  const out = await readFile(tout);
  await unlink(tin).catch(() => {});
  await unlink(tout).catch(() => {});
  return out;
}

const { data: templates, error } = await db
  .from('story_templates')
  .select('id, title, preview_image_url, suggested_style_id')
  .not('preview_image_url', 'is', null)
  .order('sort_order');
if (error) throw error;
console.log(`▸ lettering titles onto ${templates.length} templates…`);

/**
 * Colour rule for the title lettering. Multi-colour-per-letter only reads as
 * intentional for the crayon-scribble style; every other style gets ONE
 * unified colour (a per-line accent at most), never rainbow letters.
 */
function colorInstruction(styleId) {
  if (styleId === 'crayon') {
    return {
      key: 'crayon',
      text: 'Colour the lettering playfully like a child\'s crayon drawing — letters may be different bright colours.',
    };
  }
  return {
    key: 'unified',
    text: 'Use a SINGLE unified colour for the entire title, drawn from the artwork\'s palette. Do NOT colour individual letters or words differently; at most the colour may change once per line break. The whole headline should read as one cohesive piece of lettering.',
  };
}

/**
 * The canonical title-LESS preview, so re-runs always letter the clean art
 * (never the DB column, which we overwrite with the titled version). Originals
 * live at template-previews/{id}.{jpg,png}; fall back to the DB value.
 */
async function originalPreviewUrl(t) {
  for (const ext of ['jpg', 'png']) {
    const url = db.storage.from('renders').getPublicUrl(`template-previews/${t.id}.${ext}`).data.publicUrl;
    const res = await fetch(url, { method: 'HEAD' }).catch(() => null);
    if (res?.ok) return url;
  }
  return t.preview_image_url;
}

for (const t of templates) {
  const st = (progress.done[t.id] ??= {});
  const color = colorInstruction(t.suggested_style_id);
  try {
    // 1. Letter the title into the flat preview, integrated into the scene.
    // Redo if the colour rule changed since this template was last lettered.
    if (!st.titledPreview || st.colorRule !== color.key) {
      const src = await originalPreviewUrl(t);
      const prompt =
        `Add the book title to this children's picture-book cover, integrated naturally into the illustration as though it were painted as part of the scene — NOT as a caption sitting in a blank band. ` +
        `Render it as large hand-lettering in the SAME art medium and texture as the artwork, arranged across the top of the composition but overlapping and interacting with the scene: let sky, clouds, foliage, stars or other background elements weave around and behind the letters, and add a few small decorative flourishes (doodles, swirls, a hand-drawn underline) that tie the lettering into the picture so the whole cover reads as one artwork. ` +
        `${color.text} ` +
        `The title MUST read EXACTLY, spelled letter-for-letter: "${t.title}" — do not invent, rename, shorten, translate, or add any other words. ` +
        `Keep the characters, colours, framing and overall composition intact; only add the integrated title lettering, and keep it clearly legible.`;
      const out = await replicate.run('google/nano-banana-pro', {
        input: { prompt, image_input: [src], aspect_ratio: '1:1', output_format: 'png' },
      });
      const raw = await fetchBytes(toUrl(out));
      const jpeg = await toJpeg(raw, `tt-prev-${t.id}`, 900);
      const path = `template-previews-titled/${t.id}.jpg`;
      const { error: upErr } = await db.storage.from('renders').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw new Error(`preview upload: ${upErr.message}`);
      st.titledPreview = db.storage.from('renders').getPublicUrl(path).data.publicUrl;
      st.colorRule = color.key;
      st.mockup = null; // preview changed → rebuild the mockup from it
      await db.from('story_templates').update({ preview_image_url: st.titledPreview }).eq('id', t.id);
      await saveProgress();
      console.log(`  ✓ ${t.id} titled preview (${color.key}, ${(jpeg.length / 1024).toFixed(0)}KB)`);
    }

    // 2. Rebuild the 3D mockup from the titled preview.
    if (!st.mockup) {
      const prompt =
        "Recreate this exact children's book cover illustration as a professional product photograph: a real square hardcover book photographed at a gentle 3/4 angle on a warm beige studio backdrop, spine visible on the left, soft realistic shadow beneath, subtle page edges, natural studio lighting. Match the photographic style, angle, backdrop and lighting of the two reference photos exactly. Reproduce the cover artwork faithfully on the book prop, including the title lettering; do not redraw or reinterpret it.";
      const out = await replicate.run('google/nano-banana-pro', {
        input: { prompt, image_input: [st.titledPreview, ...mockupRefUrls], aspect_ratio: '1:1', output_format: 'png' },
      });
      const raw = await fetchBytes(toUrl(out));
      const jpeg = await toJpeg(raw, `tt-mock-${t.id}`, 800);
      const path = `template-mockups-titled/${t.id}.jpg`;
      const { error: upErr } = await db.storage.from('renders').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw new Error(`mockup upload: ${upErr.message}`);
      st.mockup = db.storage.from('renders').getPublicUrl(path).data.publicUrl;
      await db.from('story_templates').update({ mockup_image_url: st.mockup }).eq('id', t.id);
      await saveProgress();
      console.log(`  ✓ ${t.id} mockup (${(jpeg.length / 1024).toFixed(0)}KB)`);
    }
  } catch (err) {
    console.log(`  ✗ ${t.id} (${t.title}): ${String(err).slice(0, 140)}`);
  }
}
console.log('Done lettering template titles.');
