import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes, upload } from '../lib/images.ts';
import { assetsDir, stateDir, ensureStateDirs } from '../lib/paths.ts';

interface StyleSpec {
  prompt: string;
  localRefs: string[];
  refUrls?: string[];
}

// Reference illustrations lifted from the customer's example books (machine-local).
const STYLES: Record<string, StyleSpec> = {
  watercolor: {
    prompt:
      "gentle soft watercolor children's picture-book illustration, delicate pencil linework, warm muted pastel palette, soft cream ground, tender sunlit storybook mood, subtle paper grain, no hard black outlines",
    localRefs: [
      'phoebe&mama - san diego - v2/Generated Image October 29, 2025 - 10_35AM.png',
      'phoebe&mama - san diego - v2/phoebe_and_mama_on_an_ocean_adventure_in_san_diego_-_discovering_ocean_creatures_on_the_beach_and_going_whale_watching_on_a_boat_page_10.png',
    ],
  },
  'retro-cartoon': {
    prompt:
      'vintage 1930s rubber-hose cartoon style, bold clean black outlines, rounded characters with big friendly eyes and white-gloved hands, flat cheerful saturated colours, warm cream ground inside a soft rounded vignette, classic golden-age animation charm',
    localRefs: [
      'phoebe&papa - zoo - v4/932f2ffa-e2d6-4ba3-98dd-c51cc2276423-book_Page_06.png',
      'phoebe&papa - zoo - v4/932f2ffa-e2d6-4ba3-98dd-c51cc2276423-book_Page_08.png',
      'phoebe&papa - zoo - v4/932f2ffa-e2d6-4ba3-98dd-c51cc2276423-book_Page_10.png',
    ],
  },
  'textured-flat': {
    prompt:
      'bold textured flat editorial children\'s-book illustration, thick confident simplified shapes, grainy screen-print texture, limited palette of teal blue, warm red, black and cream, stylised characters with rosy cheeks and dot eyes, naive folk charm, flat perspective, no gradients',
    localRefs: [
      'phoebe & mama - magical diary/a_magical_discovery_page_2.png',
      'phoebe & mama - magical diary/a_magical_discovery_page_5.png',
    ],
  },
};

// 6 sample books -> 3 styles, two books each.
const ASSIGN: Record<string, string> = {
  "Malia and Mama's Treasure Day": 'watercolor',
  'The Great Rainy-Day Fort': 'watercolor',
  'Theo, Papa, and the Flying Marshmallow': 'retro-cartoon',
  "Luna's Three Big Steps": 'retro-cartoon',
  'The Secret Ingredient': 'textured-flat',
  "Phoebe's Magic Notebook": 'textured-flat',
};

async function run(_args: ParsedArgs): Promise<void> {
  ensureStateDirs();
  const ARCHIVE = process.env.WFSC_BOOK_EXAMPLES_DIR ?? join(assetsDir, 'book-examples');
  const PROGRESS = join(stateDir, 'restyle-progress.json');

  const db = createDb();
  const replicate = createReplicate();

  let progress: { done: Record<string, string> } = { done: {} };
  try {
    progress = JSON.parse(await readFile(PROGRESS, 'utf8'));
  } catch {
    progress = { done: {} };
  }
  const saveProgress = () => writeFile(PROGRESS, JSON.stringify(progress, null, 2));

  // 1. Upload the style references once; cache their public URLs.
  await db.storage.createBucket('style-refs', { public: true }).catch(() => undefined);
  for (const [styleId, style] of Object.entries(STYLES)) {
    style.refUrls = [];
    for (let i = 0; i < style.localRefs.length; i++) {
      const path = `restyle/${styleId}/ref-${i}.png`;
      const bytes = await readFile(join(ARCHIVE, style.localRefs[i]));
      style.refUrls.push(await upload(db, 'style-refs', path, bytes, 'image/png'));
    }
    console.log(`✓ ${styleId}: ${style.refUrls.length} refs uploaded`);
  }

  async function restyle(opts: { srcUrl: string; styleId: string; isCover: boolean; title?: string }): Promise<Buffer> {
    const style = STYLES[opts.styleId];
    const base = opts.isCover
      ? `Re-illustrate this children's book COVER in a new art style, keeping the same characters and scene. Render the title in charming hand-lettering in the upper area. The title MUST read EXACTLY, spelled letter-for-letter: "${opts.title}", do not invent, rename, shorten or add any other words.`
      : "Re-illustrate this children's picture-book scene in a new art style. Keep the SAME characters, their poses, clothing, the setting and the overall composition and camera framing, change ONLY the art style.";
    const prompt = `${base} Target style: ${style.prompt}. Soft cream background. ${opts.isCover ? '' : 'Absolutely no text, letters, numbers or watermark.'}`;
    const output = await replicate.run('google/nano-banana-pro', {
      input: { prompt, image_input: [opts.srcUrl, ...(style.refUrls ?? [])], aspect_ratio: '1:1', output_format: 'png' },
    });
    return fetchBytes(toUrl(output));
  }

  // 2. Walk every sample book and restyle its cover + spreads.
  const { data: books, error } = await db
    .from('books')
    .select('id, title, cover_image_url')
    .eq('is_sample', true)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const restyledBookIds: string[] = [];
  for (const book of ((books ?? []) as { id: string; title: string; cover_image_url: string | null }[])) {
    const styleId = ASSIGN[book.title];
    if (!styleId) {
      console.log(`- skip (unassigned): ${book.title}`);
      continue;
    }
    console.log(`\n▸ ${book.title} -> ${styleId}`);
    restyledBookIds.push(book.id);
    const slug = styleId;

    const coverKey = `cover:${book.id}`;
    if (!progress.done[coverKey] && book.cover_image_url) {
      try {
        const bytes = await restyle({ srcUrl: book.cover_image_url, styleId, isCover: true, title: book.title });
        const url = await upload(db, 'renders', `restyle/${slug}/${book.id}/cover.png`, bytes, 'image/png');
        await db.from('books').update({ cover_image_url: url }).eq('id', book.id);
        progress.done[coverKey] = url;
        await saveProgress();
        console.log('  ✓ cover');
      } catch (err) {
        console.log(`  ✗ cover: ${String(err).slice(0, 160)}`);
      }
    } else {
      console.log('  · cover (cached)');
    }

    const { data: spreads } = await db
      .from('book_spreads')
      .select('id, position, image_url')
      .eq('book_id', book.id)
      .order('position');
    for (const s of ((spreads ?? []) as { id: string; position: number; image_url: string | null }[])) {
      if (!s.image_url) continue;
      const key = `spread:${s.id}`;
      if (progress.done[key]) {
        console.log(`  · spread ${s.position} (cached)`);
        continue;
      }
      try {
        const bytes = await restyle({ srcUrl: s.image_url, styleId, isCover: false });
        const url = await upload(db, 'renders', `restyle/${slug}/${book.id}/spread-${String(s.position).padStart(2, '0')}.png`, bytes, 'image/png');
        await db.from('book_spreads').update({ image_url: url }).eq('id', s.id);
        progress.done[key] = url;
        await saveProgress();
        console.log(`  ✓ spread ${s.position}`);
      } catch (err) {
        console.log(`  ✗ spread ${s.position}: ${String(err).slice(0, 160)}`);
      }
    }
  }

  // 3. Invalidate mockups so `wfsc-admin book-mockups` rebuilds them.
  if (restyledBookIds.length) {
    await db.from('books').update({ mockup_image_url: null }).in('id', restyledBookIds);
    console.log(`\n✓ cleared mockups for ${restyledBookIds.length} books (re-run book-mockups)`);
  }
  console.log('Restyle complete.');
}

export const restyleSamples: Command = {
  name: 'restyle-samples',
  summary: 'Re-render sample books in styles lifted from the example books (resumable).',
  usage: 'restyle-samples',
  run,
};
