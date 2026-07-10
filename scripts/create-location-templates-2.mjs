/**
 * Second batch of "Adventures near you" location templates (more DACH + US
 * spots), region-tagged, with generated preview art. Titled covers + mockups
 * follow via letter-template-titles.mjs.
 *
 * Run: node --env-file=.env scripts/create-location-templates-2.mjs
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';

const TMP = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : '/tmp';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const replicate = new Replicate();
await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

const TEMPLATES = [
  // --- US ---
  { id: 'san-diego', region: 'us', style: 'flat-vector', age: [2, 6], title: 'A Day in Sunny San Diego', tagline: 'Beaches, sea lions and sunshine.',
    cover: 'A child and a grown-up on a sunny San Diego beach with palm trees, a long pier and playful sea lions on the rocks.',
    scaffold: 'A sunny, easygoing San Diego day: the beach, barking sea lions, tacos on the boardwalk, a visit to see the animals. Warm and carefree.',
    beats: ['Palm trees and the first glimpse of the sea', 'Sea lions barking on the rocks', 'Toes in the warm Pacific', 'Tacos on the boardwalk', 'Saying hi to the animals at the park', 'A golden sunset over the bay'] },
  { id: 'los-angeles', region: 'us', style: 'riso-print', age: [3, 7], title: 'Our Los Angeles Adventure', tagline: 'Palms, hills and big dreams.',
    cover: 'A child and a grown-up on a palm-lined Los Angeles street, golden hills and a big white hillside sign in the distance.',
    scaffold: 'A bright, dreamy Los Angeles day: palm-lined streets, the hills with the famous sign, a pier with a Ferris wheel, sunshine everywhere.',
    beats: ['Palm trees against a big blue sky', 'Spotting the sign up in the hills', 'A ride on the pier Ferris wheel', 'Roller skates on the boardwalk', 'A movie-star moment on a star-covered pavement', 'Sunset turning the hills pink'] },
  { id: 'san-francisco', region: 'us', style: 'mid-century', age: [3, 7], title: 'Over the Golden Bridge', tagline: 'Cable cars, fog and a famous bridge.',
    cover: 'A child and a grown-up riding a cable car up a steep hill, the great red bridge and rolling fog behind them.',
    scaffold: 'A breezy San Francisco day: clanging cable cars, the great red bridge, rolling fog, sea lions at the pier. Hilly, foggy, wonderful.',
    beats: ['Hopping on a clanging cable car', 'Up, up the steepest hill', 'The great red bridge appears through the fog', 'Sea lions lazing at the pier', 'A cup of cocoa as the fog rolls in', 'The city lights twinkling on the bay'] },
  { id: 'the-desert', region: 'us', style: 'watercolor', age: [4, 8], title: 'Under the Desert Stars', tagline: 'Cacti, red rocks and a sky full of stars.',
    cover: 'A child and a grown-up by a little campfire in a red-rock desert at night, tall cacti around them and an enormous starry sky above.',
    scaffold: 'A wide, wondrous desert night: red rocks, tall cacti, a crackling campfire, and the biggest starriest sky imaginable. Cosy against the vastness.',
    beats: ['Red rocks glowing at sunset', 'Tall cacti like desert guardians', 'Building a little campfire', 'Toasting something sweet on a stick', 'A coyote calls far away', 'Counting a thousand stars before sleep'] },
  // --- DACH ---
  { id: 'zurich', region: 'dach', style: 'mid-century', age: [3, 7], title: 'A Day in Zurich', tagline: 'Lake, trams and chocolate.',
    cover: 'A child and a grown-up beside sparkling Lake Zurich, a blue tram passing and snowy Alps on the horizon.',
    scaffold: 'A crisp, cheerful Zurich day: the sparkling lake, a blue tram, a paddle boat, and of course chocolate, with the Alps shining far away.',
    beats: ['A ride on the blue tram', 'Feeding swans on the lake', 'A paddle-boat on sparkling water', 'A square of Swiss chocolate', 'The old town’s clock tower chimes', 'Snowy Alps glowing at sunset'] },
  { id: 'graz', region: 'dach', style: 'flat-vector', age: [3, 7], title: 'Our Graz Adventure', tagline: 'A clock tower, red roofs and a river island.',
    cover: 'A child and a grown-up on the green Schlossberg hill below the famous Graz clock tower, red rooftops and a river spread out below.',
    scaffold: 'A playful Graz day: climbing the Schlossberg to the clock tower, red rooftops below, the funny floating island on the river Mur, pumpkin-seed treats.',
    beats: ['Climbing up the leafy Schlossberg', 'The big clock tower up close', 'Red rooftops as far as you can see', 'The funny floating island on the river', 'A slide back down the hill', 'A warm pretzel in the old square'] },
  { id: 'vorarlberg', region: 'dach', style: 'watercolor', age: [3, 7], title: 'Mountains and the Big Lake', tagline: 'Alpine meadows above Lake Constance.',
    cover: 'A child and a grown-up in a flowery Vorarlberg alpine meadow high above shimmering Lake Constance, gentle cows with bells nearby.',
    scaffold: 'A fresh Vorarlberg day: flowery alpine meadows, cows with bells, a cable car, and the huge shimmering Lake Constance far below.',
    beats: ['A cable car up to the meadows', 'Cows with jingling bells', 'Picking wildflowers in the grass', 'A wedge of mountain cheese', 'The huge lake shining far below', 'Rolling down a soft green slope'] },
  { id: 'salzburg', region: 'dach', style: 'mid-century', age: [3, 7], title: 'A Salzburg Fairytale', tagline: 'A hilltop fortress and a song in the air.',
    cover: 'A child and a grown-up in a green garden before the great hilltop Salzburg fortress, baroque domes and mountains behind them.',
    scaffold: 'A storybook Salzburg day: the hilltop fortress, baroque domes, garden fountains, a horse carriage, and music drifting everywhere.',
    beats: ['The fortress high on its hill', 'A carriage clip-clopping through squares', 'Splashing at a garden fountain', 'Humming a tune in the gardens', 'A chocolate-y Mozart treat', 'The fortress glowing at dusk'] },
  { id: 'munich', region: 'dach', style: 'riso-print', age: [3, 7], title: 'A Munich Day', tagline: 'A glockenspiel, pretzels and a big park.',
    cover: 'A child and a grown-up in Munich’s Marienplatz below the ornate town hall with its glockenspiel, a giant pretzel in hand.',
    scaffold: 'A jolly Munich day: the Marienplatz glockenspiel, giant pretzels, surfers on the river wave, and the huge English Garden.',
    beats: ['The glockenspiel figures spin and dance', 'A giant soft pretzel to share', 'Watching surfers on the city river wave', 'A carousel in the big English Garden', 'Feeding ducks by the stream', 'Tired, happy, pretzel-crumbed and home'] },
  { id: 'hamburg', region: 'dach', style: 'flat-vector', age: [2, 6], title: 'A Day at Hamburg Harbour', tagline: 'Big ships, cranes and seagulls.',
    cover: 'A child and a grown-up at the bustling Hamburg harbour with enormous ships, tall cranes, red-brick warehouses and swirling seagulls.',
    scaffold: 'A breezy Hamburg harbour day: enormous ships, tall cranes, a little harbour ferry, cheeky seagulls, and a warm fish roll.',
    beats: ['Enormous ships along the quay', 'A ride on the little harbour ferry', 'Waving at a giant crane', 'Cheeky seagulls after a snack', 'Exploring the red-brick warehouse maze', 'Foghorns as the boats head out'] },
];

const { data: styles } = await db.from('styles').select('id, style_prompt, reference_image_urls');
const styleById = Object.fromEntries((styles ?? []).map((s) => [s.id, s]));
const toUrl = (o) => (typeof o === 'string' ? o : Array.isArray(o) ? String(o[0]) : String(o.url?.() ?? o.url));

let sort = 9;
for (const t of TEMPLATES) {
  try {
    await db.from('story_templates').upsert(
      {
        id: t.id, category_id: 'places', region: t.region, title: t.title, tagline: t.tagline,
        description: t.tagline, suggested_style_id: t.style, story_beats: t.beats,
        prompt_scaffold: t.scaffold, cover_concept: t.cover, age_min: t.age[0], age_max: t.age[1],
        occasions: [], sort_order: sort++, is_active: true,
      },
      { onConflict: 'id' },
    );
    const { data: fresh } = await db.from('story_templates').select('preview_image_url').eq('id', t.id).single();
    if (fresh?.preview_image_url) { console.log(`  · ${t.id} (preview exists)`); continue; }

    const style = styleById[t.style] ?? styles[0];
    const out = await replicate.run('google/nano-banana-pro', {
      input: {
        prompt: `Children's picture-book cover illustration (no text, no title, no lettering): ${t.cover} Generic charming characters. Style: ${style.style_prompt}. Reserve a quiet area in the upper third.`,
        aspect_ratio: '1:1', output_format: 'png',
        ...(style.reference_image_urls?.length ? { image_input: style.reference_image_urls.slice(0, 1) } : {}),
      },
    });
    const raw = Buffer.from(await (await fetch(toUrl(out))).arrayBuffer());
    const tin = `${TMP}/loc2-${t.id}.png`, tout = `${TMP}/loc2-${t.id}.jpg`;
    await writeFile(tin, raw);
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '--resampleWidth', '900', tin, '--out', tout]);
    const jpeg = await readFile(tout);
    await unlink(tin).catch(() => {}); await unlink(tout).catch(() => {});
    const path = `template-previews/${t.id}.jpg`;
    await db.storage.from('renders').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
    const pub = db.storage.from('renders').getPublicUrl(path).data.publicUrl;
    await db.from('story_templates').update({ preview_image_url: pub }).eq('id', t.id);
    console.log(`  ✓ ${t.id} (${t.region}) preview`);
  } catch (err) {
    console.log(`  ✗ ${t.id}: ${String(err).slice(0, 140)}`);
  }
}
console.log('Done creating location templates batch 2.');
