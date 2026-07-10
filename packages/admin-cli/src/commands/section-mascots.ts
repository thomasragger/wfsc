import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagStr } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes, upload } from '../lib/images.ts';
import { repoRoot, assetsDir } from '../lib/paths.ts';

const CHARACTER =
  'the EXACT same character shown in the reference image: a round fluffy orange blob creature with a gentle closed-eye smile, small nubby feet, and a thick hand-drawn dark-orange outline with short sketchy fur strokes. Same colour, same proportions, same soft childlike style.';

const MASCOTS = [
  { file: 'story', bg: 'soft pale lavender', action: 'happily holding an open picture book, as if reading a story. A tiny pencil tucked nearby.' },
  { file: 'travel', bg: 'soft pale sky blue', action: 'as a cheerful little explorer wearing a small hat, holding a folded paper map, ready for an adventure.' },
  { file: 'family', bg: 'soft pale rosy pink', action: 'beside a smaller version of the same fuzzy orange creature (a little one), the two of them close together and happy, like family.' },
];

async function run(args: ParsedArgs): Promise<void> {
  const ref = flagStr(args, 'ref', process.env.WFSC_MASCOT_REF ?? join(assetsDir, 'assets', 'mascot-ref.png'));
  const outDir = flagStr(args, 'out', join(repoRoot, 'apps', 'studio', 'public', 'mascots'));
  await mkdir(outDir, { recursive: true });

  const db = createDb();
  const replicate = createReplicate();
  await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

  const refUrl = await upload(db, 'renders', 'brand/mascot-ref.png', await readFile(ref), 'image/png');
  console.log('✓ mascot reference uploaded');

  for (const m of MASCOTS) {
    try {
      const prompt =
        `Draw ${CHARACTER} This time the character is ${m.action} ` +
        `Keep it simple, centered and friendly, in the same flat hand-drawn illustration style with thick outlines. ` +
        `Place it on a solid ${m.bg} background that completely fills the whole square image, one flat pastel colour only, no checkerboard, no pattern, no gradient, no white edges or corners.`;
      const out = await replicate.run('google/nano-banana-pro', {
        input: { prompt, image_input: [refUrl], aspect_ratio: '1:1', output_format: 'png' },
      });
      const raw = await fetchBytes(toUrl(out));
      const dest = join(outDir, `${m.file}.png`);
      await writeFile(dest, raw);
      execFileSync('sips', ['--resampleWidth', '512', dest]);
      const sz = (await readFile(dest)).length;
      console.log(`  ✓ ${m.file}.png (${(sz / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.log(`  ✗ ${m.file}: ${String(err).slice(0, 140)}`);
    }
  }
  console.log('Done generating section mascots.');
}

export const sectionMascots: Command = {
  name: 'section-mascots',
  summary: 'Generate three themed homepage mascots from the WFSC character on transparent bg.',
  usage: 'section-mascots [--ref <mascot.png>] [--out <dir>]',
  run,
};
