/**
 * CLI harness: generate a complete book from a local config, end to end.
 * This is the pipeline quality-iteration loop — no database, no Shopify.
 *
 * Usage:
 *   REPLICATE_API_TOKEN=... ANTHROPIC_API_KEY=... \
 *   pnpm generate-book path/to/config.json [output-dir]
 *
 * Config shape (see test-fixtures/example-config.json):
 * {
 *   "memoryText": "...",
 *   "people": [{ "name": "Phoebe", "role": "child", "photoPaths": ["./phoebe1.jpg"] }],
 *   "styleId": "flat-vector",
 *   "styleReferencePaths": ["./style-ref-1.png"],
 *   "spreadCount": 14,
 *   "greeting": "For Phoebe, love Papa",
 *   "fontPairing": "storybook"
 * }
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';

import type { BookData, SpreadData } from '@wfsc/book-engine';
import { renderInteriorPdf } from '@wfsc/book-engine/pdf';

import { describeCharacter } from '../describe';
import { generateCharacterSheet, generateSpreadImage, upscaleImage } from '../images';
import { judgeSpreadSafe } from '../qa';
import { generateStory } from '../story';
import { BUILTIN_STYLES } from '../styles';
import type { CharacterSheet, Story, StyleDef } from '../types';

const MAX_RETRIES_PER_SPREAD = 2;
/** Low-credit Replicate accounts allow a burst of only 5 prediction creates. */
const SPREAD_CONCURRENCY = Number(process.env.WFSC_SPREAD_CONCURRENCY ?? 3);

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Local file → URL usable as a Replicate model input. Small files become data
 * URIs; larger ones are uploaded via the Replicate Files API (data URIs are
 * limited to ~256KB).
 */
async function fileToDataUri(path: string): Promise<string> {
  const bytes = await readFile(path);
  const mime = MIME[extname(path).toLowerCase()] ?? 'image/jpeg';
  if (bytes.length < 200_000) {
    return `data:${mime};base64,${bytes.toString('base64')}`;
  }
  const { default: Replicate } = await import('replicate');
  const replicate = new Replicate();
  const file = await replicate.files.create(
    new File([bytes], path.split('/').pop() ?? 'image', { type: mime }),
  );
  return file.urls.get;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

interface CliConfig {
  memoryText: string;
  people: { name: string; role?: string; photoPaths?: string[]; appearance?: string }[];
  styleId: string;
  styleReferencePaths?: string[];
  spreadCount?: number;
  greeting?: string;
  fontPairing?: BookData['fontPairing'];
}

async function main() {
  const [configPath, outDirArg] = process.argv.slice(2);
  if (!configPath) {
    console.error('Usage: pnpm generate-book <config.json> [output-dir]');
    process.exit(1);
  }
  const configDir = dirname(resolve(configPath));
  const config = JSON.parse(await readFile(configPath, 'utf8')) as CliConfig;
  const outDir = resolve(outDirArg ?? join(configDir, 'generated'));
  await mkdir(join(outDir, 'sheets'), { recursive: true });
  await mkdir(join(outDir, 'spreads'), { recursive: true });

  const builtin = BUILTIN_STYLES[config.styleId];
  if (!builtin) throw new Error(`Unknown styleId '${config.styleId}'`);
  const style: StyleDef = {
    ...builtin,
    referenceImageUrls: await Promise.all(
      (config.styleReferencePaths ?? []).map((p) => fileToDataUri(resolve(configDir, p))),
    ),
  };

  // 1. Story (cached across reruns) --------------------------------------------
  let story!: Story;
  const storyPath = join(outDir, 'story.json');
  try {
    story = JSON.parse(await readFile(storyPath, 'utf8'));
    console.log(`▸ Reusing cached story: "${story.title}"`);
  } catch {
    console.log('▸ Writing story…');
    story = await generateStory({
      memoryText: config.memoryText,
      people: config.people.map((p) => ({ name: p.name, role: p.role, photoUrls: [] })),
      spreadCount: config.spreadCount,
    });
    await writeFile(storyPath, JSON.stringify(story, null, 2));
    console.log(`  "${story.title}" — ${story.spreads.length} spreads`);
  }

  // 2. Character sheets --------------------------------------------------------
  const characters: CharacterSheet[] = [];
  for (const person of config.people) {
    console.log(`▸ Character sheet: ${person.name}…`);
    const photoUrls = await Promise.all(
      (person.photoPaths ?? []).map((p) => fileToDataUri(resolve(configDir, p))),
    );
    const { sheetUrl } = await generateCharacterSheet(
      { name: person.name, role: person.role, photoUrls, appearance: person.appearance },
      style,
    );
    const localSheet = join(outDir, 'sheets', `${person.name.toLowerCase()}.png`);
    await download(sheetUrl, localSheet);
    const description = await describeCharacter(
      { name: person.name, role: person.role, photoUrls: [] },
      sheetUrl,
    );
    console.log(`  ${person.name}: ${description}`);
    characters.push({ name: person.name, role: person.role, sheetUrl, description });
  }

  // 3. Spreads (parallel) + QA + retry ------------------------------------------
  console.log(`▸ Generating ${story.spreads.length} spreads + cover in parallel…`);
  const spreadJobs = [
    { index: 0, prompt: story.cover_prompt, copySpace: 'upper third for the title', layout: 'text-left' as const, isCover: true },
    ...story.spreads.map((s, i) => ({
      index: i + 1,
      prompt: s.illustration_prompt,
      copySpace: s.copy_space,
      layout: s.layout,
      isCover: false,
    })),
  ];

  const results = await mapWithConcurrency(spreadJobs, SPREAD_CONCURRENCY, async (job) => {
      let lastUrl = '';
      let lastNotes = '';
      for (let attempt = 0; attempt <= MAX_RETRIES_PER_SPREAD; attempt++) {
        const { imageUrl } = await generateSpreadImage({
          spread: { illustration_prompt: job.prompt, copy_space: job.copySpace, layout: job.layout },
          characters,
          style,
        });
        lastUrl = imageUrl;
        const verdict = await judgeSpreadSafe(imageUrl, characters, style.stylePrompt);
        console.log(
          `  ${job.isCover ? 'cover' : `spread ${job.index}`}: score ${verdict.score}${verdict.pass ? ' ✓' : ` ✗ (${verdict.notes})`}`,
        );
        if (verdict.pass) return { ...job, imageUrl, score: verdict.score };
        lastNotes = verdict.notes;
      }
      console.warn(`  ! ${job.isCover ? 'cover' : `spread ${job.index}`} kept best-effort after retries (${lastNotes})`);
      return { ...job, imageUrl: lastUrl, score: 0 };
  });

  // 4. Upscale + download --------------------------------------------------------
  console.log('▸ Upscaling to print resolution…');
  const upscaled = await mapWithConcurrency(results, SPREAD_CONCURRENCY, async (r) => {
      const { imageUrl } = await upscaleImage(r.imageUrl);
      const file = join(outDir, 'spreads', r.isCover ? 'cover.png' : `spread-${String(r.index).padStart(2, '0')}.png`);
      await download(imageUrl, file);
      return { ...r, printImageUrl: imageUrl, localPath: file };
  });

  // 5. Compose PDF ----------------------------------------------------------------
  console.log('▸ Rendering PDF…');
  const cover = upscaled.find((r) => r.isCover)!;
  const spreads: SpreadData[] = story.spreads.map((s, i) => {
    const gen = upscaled.find((r) => !r.isCover && r.index === i + 1)!;
    return {
      id: `spread-${i + 1}`,
      position: i + 1,
      kind: 'story',
      text: s.text,
      layout: s.layout,
      imageUrl: gen.imageUrl,
      printImageUrl: gen.printImageUrl,
    };
  });
  const book: BookData = {
    id: 'cli',
    title: story.title,
    greeting: config.greeting ?? null,
    fontPairing: config.fontPairing ?? 'storybook',
    styleId: config.styleId,
    spreads,
    coverImageUrl: cover.imageUrl,
    coverPrintImageUrl: cover.printImageUrl,
    peopleNames: config.people.map((p) => p.name),
  };

  const puppeteer = await import('puppeteer-core');
  const executablePath =
    process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const pdfBytes = await renderInteriorPdf(browser, book);
    await writeFile(join(outDir, 'book-interior.pdf'), pdfBytes);
  } finally {
    await browser.close();
  }

  await writeFile(join(outDir, 'book.json'), JSON.stringify(book, null, 2));
  console.log(`✓ Done → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
