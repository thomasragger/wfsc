import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagStr } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes, upload } from '../lib/images.ts';
import { repoRoot, assetsDir } from '../lib/paths.ts';

const CHARACTER =
  'the EXACT same character shown in the reference image: a round fluffy orange blob creature with a gentle closed-eye smile, small nubby feet, and a thick hand-drawn dark-orange outline with short sketchy fur strokes. Same colour, same proportions, same soft childlike style.';

/**
 * The mascot set. `file` is the output basename in public/mascots. Regenerated
 * transparent (RGBA) at 1024x1024. The three originals (story/travel/family)
 * keep their names so email wiring stays stable; the rest are new poses in the
 * same character family so transactional emails aren't always reusing 3.
 */
const MASCOTS = [
  { file: 'story', action: 'happily holding an open picture book with both little arms, as if reading a story. A tiny pencil tucked nearby.' },
  { file: 'travel', action: 'as a cheerful little explorer wearing a small hat, holding a folded paper map, mid-step and ready for an adventure.' },
  { file: 'family', action: 'beside a smaller version of the same fuzzy orange creature (a little one), the two of them close together and happy, like family.' },
  { file: 'paint', action: 'standing at a small wooden easel, holding a paintbrush and happily painting a colourful picture, a few cheerful paint dabs nearby, as if illustrating a book.' },
  { file: 'welcome', action: 'with one little arm raised, waving hello in a warm, friendly greeting, looking especially welcoming and glad to see you.' },
  { file: 'celebrate', action: 'joyfully holding a finished picture book up high with both arms, a few soft sparkles and bits of confetti floating around, celebrating.' },
];

/** Pure chroma-key green: far from the warm orange character, so keying it out
 *  never punches holes in the mascot itself. */
const KEY_HEX = '#00d21e';

/**
 * Key a solid chroma-green background out to full transparency and return a
 * 1024x1024 RGBA PNG. Image models don't emit alpha, so we generate on a flat
 * green field and remove it here:
 *   1. resize to a clean 1024 square, force an alpha channel;
 *   2. flood-fill inward from the four corners over pixels near the key colour
 *      (connectivity means a genuinely-green pixel INSIDE the character is left
 *      opaque — no holes);
 *   3. ramp alpha across the fringe for anti-aliased edges, and despill the
 *      green channel on those semi-transparent pixels so no green halo remains.
 */
async function chromaKeyToTransparent(raw: Buffer, size = 1024): Promise<Buffer> {
  const { data: px, info } = await sharp(raw)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info; // channels === 4 after ensureAlpha

  // Sample the key colour from the four corners (average) rather than trusting
  // the nominal hex, so slight model tinting is handled.
  const cornerOffsets = [
    0,
    (width - 1) * channels,
    (height - 1) * width * channels,
    ((height - 1) * width + (width - 1)) * channels,
  ];
  let kr = 0, kg = 0, kb = 0;
  for (const c of cornerOffsets) { kr += px[c]; kg += px[c + 1]; kb += px[c + 2]; }
  kr = Math.round(kr / 4); kg = Math.round(kg / 4); kb = Math.round(kb / 4);

  const dist2 = (i: number): number => {
    const dr = px[i] - kr, dg = px[i + 1] - kg, db = px[i + 2] - kb;
    return dr * dr + dg * dg + db * db;
  };

  // Per-channel tolerances, squared and summed over 3 channels.
  const INNER = 55 * 55 * 3; // fully transparent at/below this distance
  const OUTER = 120 * 120 * 3; // edge of the connected background region
  const n = width * height;
  const bg = new Uint8Array(n); // 1 = reached from a corner over near-key pixels
  const stack: number[] = [];
  const consider = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (bg[p]) return;
    if (dist2(p * channels) <= OUTER) { bg[p] = 1; stack.push(p); }
  };
  consider(0, 0);
  consider(width - 1, 0);
  consider(0, height - 1);
  consider(width - 1, height - 1);
  while (stack.length) {
    const p = stack.pop() as number;
    const x = p % width;
    const y = (p / width) | 0;
    consider(x + 1, y);
    consider(x - 1, y);
    consider(x, y + 1);
    consider(x, y - 1);
  }

  for (let p = 0; p < n; p++) {
    if (!bg[p]) continue; // interior character pixels stay fully opaque
    const i = p * channels;
    const d = dist2(i);
    let alpha: number;
    if (d <= INNER) alpha = 0;
    else if (d >= OUTER) alpha = 255;
    else alpha = Math.round(255 * ((d - INNER) / (OUTER - INNER)));
    px[i + 3] = alpha;
    if (alpha < 255) {
      // Despill: on the fringe, don't let green exceed the red/blue average.
      const avg = (px[i] + px[i + 2]) / 2;
      if (px[i + 1] > avg) px[i + 1] = avg;
    }
  }

  return sharp(px, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

/** Resolve a usable character reference: explicit flag/env, else the bundled
 *  asset, else an existing mascot PNG (keeps the same character family). */
function resolveRef(flag: string | undefined, outDir: string): string {
  const candidates = [
    flag,
    process.env.WFSC_MASCOT_REF,
    join(assetsDir, 'assets', 'mascot-ref.png'),
    join(outDir, 'story.png'),
    join(outDir, 'family.png'),
  ].filter((c): c is string => !!c);
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error(
    `No mascot reference found. Pass --ref <png> or set WFSC_MASCOT_REF. Tried: ${candidates.join(', ')}`,
  );
}

async function run(args: ParsedArgs): Promise<void> {
  const outDir = flagStr(args, 'out', join(repoRoot, 'apps', 'studio', 'public', 'mascots'));
  await mkdir(outDir, { recursive: true });
  const ref = resolveRef(flagStr(args, 'ref'), outDir);

  // --only story,paint restricts the run (handy for a single retry).
  const onlyRaw = flagStr(args, 'only');
  const only = onlyRaw ? new Set(onlyRaw.split(',').map((s) => s.trim())) : null;
  const targets = only ? MASCOTS.filter((m) => only.has(m.file)) : MASCOTS;

  const db = createDb();
  const replicate = createReplicate();
  await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

  const refUrl = await upload(db, 'renders', 'brand/mascot-ref.png', await readFile(ref), 'image/png');
  console.log(`✓ mascot reference uploaded (${ref})`);

  for (const m of targets) {
    try {
      const prompt =
        `Draw ${CHARACTER} This time the character is ${m.action} ` +
        `Keep it simple, single character (plus the little one only where the pose calls for it), centered and friendly, in the same flat hand-drawn illustration style with thick outlines. ` +
        `Isolated on a completely flat, solid pure chroma-key green background (hex ${KEY_HEX}): one single flat green colour filling the entire square all the way to every edge and corner, no shadow, no gradient, no pattern, no vignette, and no green anywhere on the character itself.`;
      const out = await replicate.run('google/nano-banana-pro', {
        input: { prompt, image_input: [refUrl], aspect_ratio: '1:1', output_format: 'png' },
      });
      const raw = await fetchBytes(toUrl(out));
      const rgba = await chromaKeyToTransparent(raw, 1024);
      const dest = join(outDir, `${m.file}.png`);
      await writeFile(dest, rgba);
      console.log(`  ✓ ${m.file}.png (${(rgba.length / 1024).toFixed(0)}KB, 1024² RGBA)`);
    } catch (err) {
      console.log(`  ✗ ${m.file}: ${String(err).slice(0, 200)}`);
    }
  }
  console.log('Done generating section mascots.');
}

export const sectionMascots: Command = {
  name: 'section-mascots',
  summary: 'Generate the WFSC mascots as transparent 1024² PNGs (chroma-keyed).',
  usage: 'section-mascots [--ref <mascot.png>] [--out <dir>] [--only story,paint]',
  run,
};
