/**
 * Re-render the sample books in three illustration styles drawn from the
 * user's example books (archive/book-examples). Each sample book is assigned
 * one style; every illustration (cover + story spreads) is re-rendered by
 * style-transfer: the CURRENT illustration is fed as the content/composition
 * anchor alongside 2-3 style-reference images, and nano-banana-pro repaints
 * it in the new style. Story text, layout and composition are preserved.
 *
 * Resumable: progress is journalled to scripts/.restyle-progress.json, so a
 * re-run skips already-restyled images. After a full pass it nulls the
 * restyled books' mockup_image_url so generate-book-mockups.mjs rebuilds them.
 *
 * Run: node --env-file=.env scripts/restyle-samples.mjs
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { readFile, writeFile } from 'node:fs/promises';

const ARCHIVE = '/Users/thomasragger/Desktop/personal-lab/wfsc-website/archive/book-examples';
const PROGRESS = 'scripts/.restyle-progress.json';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const replicate = new Replicate();

// Local reference illustrations lifted from the example books.
const STYLES = {
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
      "vintage 1930s rubber-hose cartoon style, bold clean black outlines, rounded characters with big friendly eyes and white-gloved hands, flat cheerful saturated colours, warm cream ground inside a soft rounded vignette, classic golden-age animation charm",
    localRefs: [
      'phoebe&papa - zoo - v4/932f2ffa-e2d6-4ba3-98dd-c51cc2276423-book_Page_06.png',
      'phoebe&papa - zoo - v4/932f2ffa-e2d6-4ba3-98dd-c51cc2276423-book_Page_08.png',
      'phoebe&papa - zoo - v4/932f2ffa-e2d6-4ba3-98dd-c51cc2276423-book_Page_10.png',
    ],
  },
  'textured-flat': {
    prompt:
      "bold textured flat editorial children's-book illustration, thick confident simplified shapes, grainy screen-print texture, limited palette of teal blue, warm red, black and cream, stylised characters with rosy cheeks and dot eyes, naive folk charm, flat perspective, no gradients",
    localRefs: [
      'phoebe & mama - magical diary/a_magical_discovery_page_2.png',
      'phoebe & mama - magical diary/a_magical_discovery_page_5.png',
    ],
  },
};

// 6 sample books → 3 styles, two books each.
const ASSIGN = {
  "Malia and Mama's Treasure Day": 'watercolor',
  'The Great Rainy-Day Fort': 'watercolor',
  'Theo, Papa, and the Flying Marshmallow': 'retro-cartoon',
  "Luna's Three Big Steps": 'retro-cartoon',
  'The Secret Ingredient': 'textured-flat',
  "Phoebe's Magic Notebook": 'textured-flat',
};

async function loadProgress() {
  try {
    return JSON.parse(await readFile(PROGRESS, 'utf8'));
  } catch {
    return { done: {} };
  }
}
let progress = await loadProgress();
const saveProgress = () => writeFile(PROGRESS, JSON.stringify(progress, null, 2));

// 1. Upload the style references once; cache their public URLs.
await db.storage.createBucket('style-refs', { public: true }).catch(() => undefined);
for (const [styleId, style] of Object.entries(STYLES)) {
  style.refUrls = [];
  for (let i = 0; i < style.localRefs.length; i++) {
    const path = `restyle/${styleId}/ref-${i}.png`;
    const bytes = await readFile(`${ARCHIVE}/${style.localRefs[i]}`);
    const { error } = await db.storage.from('style-refs').upload(path, bytes, {
      contentType: 'image/png',
      upsert: true,
    });
    if (error) throw new Error(`ref upload ${path}: ${error.message}`);
    style.refUrls.push(db.storage.from('style-refs').getPublicUrl(path).data.publicUrl);
  }
  console.log(`✓ ${styleId}: ${style.refUrls.length} refs uploaded`);
}

async function restyle({ srcUrl, styleId, isCover, title }) {
  const style = STYLES[styleId];
  const base = isCover
    ? `Re-illustrate this children's book COVER in a new art style, keeping the same characters and scene. Render the title in charming hand-lettering in the upper area. The title MUST read EXACTLY, spelled letter-for-letter: "${title}" — do not invent, rename, shorten or add any other words.`
    : "Re-illustrate this children's picture-book scene in a new art style. Keep the SAME characters, their poses, clothing, the setting and the overall composition and camera framing — change ONLY the art style.";
  const prompt = `${base} Target style: ${style.prompt}. Soft cream background. ${isCover ? '' : 'Absolutely no text, letters, numbers or watermark.'}`;
  const output = await replicate.run('google/nano-banana-pro', {
    input: {
      prompt,
      image_input: [srcUrl, ...style.refUrls],
      aspect_ratio: '1:1',
      output_format: 'png',
    },
  });
  const url = typeof output === 'string' ? output : Array.isArray(output) ? String(output[0]) : String(output.url?.() ?? output.url);
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

async function uploadRender(path, bytes) {
  const { error } = await db.storage.from('renders').upload(path, bytes, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return db.storage.from('renders').getPublicUrl(path).data.publicUrl;
}

// 2. Walk every sample book and restyle its cover + spreads.
const { data: books, error } = await db
  .from('books')
  .select('id, title, cover_image_url')
  .eq('is_sample', true)
  .order('created_at', { ascending: true });
if (error) throw error;

const restyledBookIds = [];
for (const book of books) {
  const styleId = ASSIGN[book.title];
  if (!styleId) {
    console.log(`- skip (unassigned): ${book.title}`);
    continue;
  }
  console.log(`\n▸ ${book.title} → ${styleId}`);
  restyledBookIds.push(book.id);
  const slug = styleId; // storage namespace per style keeps paths tidy

  // Cover
  const coverKey = `cover:${book.id}`;
  if (!progress.done[coverKey] && book.cover_image_url) {
    try {
      const bytes = await restyle({ srcUrl: book.cover_image_url, styleId, isCover: true, title: book.title });
      const url = await uploadRender(`restyle/${slug}/${book.id}/cover.png`, bytes);
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

  // Spreads
  const { data: spreads } = await db
    .from('book_spreads')
    .select('id, position, image_url')
    .eq('book_id', book.id)
    .order('position');
  for (const s of spreads ?? []) {
    if (!s.image_url) continue;
    const key = `spread:${s.id}`;
    if (progress.done[key]) {
      console.log(`  · spread ${s.position} (cached)`);
      continue;
    }
    try {
      const bytes = await restyle({ srcUrl: s.image_url, styleId, isCover: false });
      const url = await uploadRender(`restyle/${slug}/${book.id}/spread-${String(s.position).padStart(2, '0')}.png`, bytes);
      await db.from('book_spreads').update({ image_url: url }).eq('id', s.id);
      progress.done[key] = url;
      await saveProgress();
      console.log(`  ✓ spread ${s.position}`);
    } catch (err) {
      console.log(`  ✗ spread ${s.position}: ${String(err).slice(0, 160)}`);
    }
  }
}

// 3. Invalidate mockups so generate-book-mockups.mjs rebuilds them from the
//    new covers.
if (restyledBookIds.length) {
  await db.from('books').update({ mockup_image_url: null }).in('id', restyledBookIds);
  console.log(`\n✓ cleared mockups for ${restyledBookIds.length} books (re-run generate-book-mockups.mjs)`);
}
console.log('Restyle complete.');
