/**
 * Generate three themed mascots from the existing fuzzy WFSC character (one per
 * homepage axis), keeping the SAME character, on a transparent background.
 * Saves PNGs into apps/studio/public/mascots/.
 *
 * Run: node --env-file=.env scripts/generate-section-mascots.mjs
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const MASCOT = '/Users/thomasragger/Desktop/personal-lab/wfsc-website/archive/assets/Generated Image September 10, 2025 - 2_40PM.png';
const OUT = '/Users/thomasragger/Desktop/personal-lab/wfsc-website/wfsc/apps/studio/public/mascots';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const replicate = new Replicate();
await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

// Upload the reference mascot once for use as an image_input.
const refBytes = await readFile(MASCOT);
await db.storage.from('renders').upload('brand/mascot-ref.png', refBytes, { contentType: 'image/png', upsert: true });
const refUrl = db.storage.from('renders').getPublicUrl('brand/mascot-ref.png').data.publicUrl;
console.log('✓ mascot reference uploaded');

const CHARACTER =
  'the EXACT same character shown in the reference image: a round fluffy orange blob creature with a gentle closed-eye smile, small nubby feet, and a thick hand-drawn dark-orange outline with short sketchy fur strokes. Same colour, same proportions, same soft childlike style.';

const MASCOTS = [
  { file: 'story', bg: 'soft pale lavender', action: 'happily holding an open picture book, as if reading a story. A tiny pencil tucked nearby.' },
  { file: 'travel', bg: 'soft pale sky blue', action: 'as a cheerful little explorer wearing a small hat, holding a folded paper map, ready for an adventure.' },
  { file: 'family', bg: 'soft pale rosy pink', action: 'beside a smaller version of the same fuzzy orange creature (a little one), the two of them close together and happy, like family.' },
];

const toUrl = (o) => (typeof o === 'string' ? o : Array.isArray(o) ? String(o[0]) : String(o.url?.() ?? o.url));

for (const m of MASCOTS) {
  try {
    const prompt =
      `Draw ${CHARACTER} This time the character is ${m.action} ` +
      `Keep it simple, centered and friendly, in the same flat hand-drawn illustration style with thick outlines. ` +
      `Place it on a solid ${m.bg} background that completely fills the whole square image — one flat pastel colour only, no checkerboard, no pattern, no gradient, no white edges or corners.`;
    const out = await replicate.run('google/nano-banana-pro', {
      input: { prompt, image_input: [refUrl], aspect_ratio: '1:1', output_format: 'png' },
    });
    const raw = Buffer.from(await (await fetch(toUrl(out))).arrayBuffer());
    const dest = `${OUT}/${m.file}.png`;
    await writeFile(dest, raw);
    // Resize in place (keeps PNG alpha).
    execFileSync('sips', ['--resampleWidth', '512', dest]);
    const sz = (await readFile(dest)).length;
    console.log(`  ✓ ${m.file}.png (${(sz / 1024).toFixed(0)}KB)`);
  } catch (err) {
    console.log(`  ✗ ${m.file}: ${String(err).slice(0, 140)}`);
  }
}
console.log('Done generating section mascots.');
