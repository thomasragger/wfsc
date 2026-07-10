/**
 * Create the "Adventures near you" location templates (real, recognizable
 * places), region-tagged (dach|us) so the site can show the right ones by
 * visitor region, then generate a preview illustration for each.
 *
 * Titled previews + 3D mockups are produced later by letter-template-titles.mjs
 * (it picks up any template with a preview and no colour-rule stamp yet).
 *
 * Run: node --env-file=.env scripts/create-location-templates.mjs
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
  // --- DACH ---
  { id: 'vienna-day', region: 'dach', style: 'mid-century', age: [3, 7], title: 'A Day in Vienna', tagline: 'Carriage rides, castles and cake.',
    cover: 'A child and a grown-up riding a horse-drawn carriage past a grand Viennese palace, a giant Ferris wheel in the distance.',
    scaffold: 'A warm, wonder-filled day exploring Vienna. Use real landmarks (Schönbrunn palace, the Prater Ferris wheel, a slice of Sachertorte). The city itself is the playground.',
    beats: ['Arriving at the grand palace', 'A clip-clop horse-drawn carriage ride', 'Spinning high on the giant Ferris wheel at the Prater', 'A slice of chocolate Sachertorte', 'Feeding pigeons in a grand square', 'Music drifting from a street performer', 'A tired, happy walk home along the river'] },
  { id: 'alps-adventure', region: 'dach', style: 'flat-vector', age: [3, 7], title: 'Our Big Alps Adventure', tagline: 'Up the mountain, cowbells and all.',
    cover: 'A child and a grown-up riding a cable car up lush green Alps, with a wooden hut and cows below and snowy peaks above.',
    scaffold: 'A fresh-air mountain day in the Alps: a cable car, alpine cows with jingling bells, a wooden hut with hot cocoa, and awe at the peaks.',
    beats: ['Packing rucksacks for the mountain', 'Riding the cable car up and up', 'Cows with jingling bells in a green meadow', 'A picnic at a little wooden hut', 'Spotting a cheeky marmot', 'Cocoa at the very top', 'The long, sleepy way home with the peaks behind'] },
  { id: 'berlin-day', region: 'dach', style: 'riso-print', age: [4, 8], title: 'A Berlin Day', tagline: 'Big gates, bright lights, best day.',
    cover: 'A child and a grown-up in front of the columned Brandenburg Gate, a red tram and a tall round TV tower behind them.',
    scaffold: 'A lively, curious romp through Berlin: the Brandenburg Gate, the tall TV tower, a shared currywurst, a ride on the U-Bahn. The big city as adventure.',
    beats: ['Through the great columned gate', 'Up the tall round tower for the view', 'Sharing a currywurst', 'Riding the yellow U-Bahn', 'A park with a carousel', 'Street musicians and dancing', 'City lights on the way home'] },
  { id: 'fairytale-castle', region: 'dach', style: 'watercolor', age: [3, 7], title: 'The Fairytale Castle', tagline: 'A real castle on a misty hill.',
    cover: 'A child and a grown-up gazing up at a white fairytale castle with tall turrets on a forested hill, swans on a lake below.',
    scaffold: 'A dreamy, storybook day at a hilltop castle in the Bavarian hills: a carriage up the winding road, swans, turrets, and make-believe knights and rulers.',
    beats: ['The castle appears through the trees', 'A carriage up the winding hill', 'Counting all the turrets', 'Swans gliding on the lake', 'Pretending to be knight and ruler', 'A pretzel picnic on the grass', 'Waving goodbye to the castle'] },
  // --- US ---
  { id: 'new-york-adventure', region: 'us', style: 'flat-vector', age: [3, 7], title: 'Our New York Adventure', tagline: 'Yellow cabs and giant buildings.',
    cover: 'A child and a grown-up in a green park with yellow taxis and tall skyscrapers rising behind the trees.',
    scaffold: 'A bright, bustling New York day: yellow cabs, a big green park, a giant building with a sky-high view, a warm street pretzel. The city as pure wonder.',
    beats: ['A ride in a bright yellow cab', 'Looking up, up, up at the giant buildings', 'A rowboat or carousel in the big park', 'A warm salty street pretzel', 'The view from the top of the world', 'A street musician and dancing pigeons', 'The city lights twinkling at night'] },
  { id: 'grand-canyon', region: 'us', style: 'mid-century', age: [4, 8], title: 'The Great Big Canyon', tagline: 'The biggest view in the world.',
    cover: 'A child and a grown-up standing at a canyon rim at sunset, layers of red rock stretching to the horizon.',
    scaffold: 'Awe and wide-open wonder at the Grand Canyon: the enormous view, a mule on the trail, a booming echo, sunset colours. Feeling small and happy together.',
    beats: ['The canyon opens up enormous', 'Shouting to hear the echo bounce back', 'A patient mule on the trail', 'A great bird soaring below the rim', 'Rock layers like a giant striped cake', 'Sunset paints the canyon gold and pink', 'Stars come out over the rim'] },
  { id: 'california-beach', region: 'us', style: 'crayon', age: [2, 6], title: 'A California Beach Day', tagline: 'Sand, surf and a golden sunset.',
    cover: 'A child and a grown-up on a sunny California beach with a surfboard, palm trees and a long wooden pier.',
    scaffold: 'A sunny, easy California beach day: the boardwalk, a wobbly first surfboard try, ice cream on the pier, chasing waves. Carefree togetherness.',
    beats: ['Down the boardwalk to the sand', 'Toes in the cold Pacific', 'A wobbly try on a surfboard', 'Building a drippy sandcastle', 'Ice cream out on the pier', 'A seagull swipes a chip', 'A golden sunset over the water'] },
  { id: 'magical-theme-park', region: 'us', style: 'riso-print', age: [3, 7], title: 'The Most Magical Park', tagline: 'Rides, treats and one big day.',
    cover: 'A child and a grown-up at the colourful gates of a theme park, a castle-topped carousel and balloons behind them.',
    scaffold: 'A joyful theme-park day (invent a generic park, no real brands): a carousel, spinning teacups, a parade, a giant balloon, a first big ride. Pure delight together.',
    beats: ['Through the sparkling gates', 'A spin on the golden carousel', 'A first big ride: scared, then thrilled', 'A colourful parade goes by', 'Sharing an enormous swirly treat', 'A balloon that matches their shirt', 'Fireworks and sleepy shoulders home'] },
];

const { data: styles } = await db.from('styles').select('id, style_prompt, reference_image_urls');
const styleById = Object.fromEntries((styles ?? []).map((s) => [s.id, s]));

const toUrl = (o) => (typeof o === 'string' ? o : Array.isArray(o) ? String(o[0]) : String(o.url?.() ?? o.url));

let sort = 1;
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
    const tin = `${TMP}/loc-${t.id}.png`, tout = `${TMP}/loc-${t.id}.jpg`;
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
console.log('Done creating location templates.');
