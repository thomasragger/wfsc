import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes, toJpeg, upload } from '../lib/images.ts';

interface LocTemplate {
  id: string;
  region: 'dach' | 'us';
  style: string;
  age: [number, number];
  title: string;
  tagline: string;
  cover: string;
  scaffold: string;
  beats: string[];
}

// "Adventures near you": real, recognizable places, region-tagged so the site
// shows the right ones per visitor region. Titled previews + 3D mockups follow
// via `wfsc-admin letter-titles`.
const TEMPLATES: LocTemplate[] = [
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
  { id: 'zurich', region: 'dach', style: 'mid-century', age: [3, 7], title: 'A Day in Zurich', tagline: 'Lake, trams and chocolate.',
    cover: 'A child and a grown-up beside sparkling Lake Zurich, a blue tram passing and snowy Alps on the horizon.',
    scaffold: 'A crisp, cheerful Zurich day: the sparkling lake, a blue tram, a paddle boat, and of course chocolate, with the Alps shining far away.',
    beats: ['A ride on the blue tram', 'Feeding swans on the lake', 'A paddle-boat on sparkling water', 'A square of Swiss chocolate', "The old town's clock tower chimes", 'Snowy Alps glowing at sunset'] },
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
    cover: "A child and a grown-up in Munich's Marienplatz below the ornate town hall with its glockenspiel, a giant pretzel in hand.",
    scaffold: 'A jolly Munich day: the Marienplatz glockenspiel, giant pretzels, surfers on the river wave, and the huge English Garden.',
    beats: ['The glockenspiel figures spin and dance', 'A giant soft pretzel to share', 'Watching surfers on the city river wave', 'A carousel in the big English Garden', 'Feeding ducks by the stream', 'Tired, happy, pretzel-crumbed and home'] },
  { id: 'hamburg', region: 'dach', style: 'flat-vector', age: [2, 6], title: 'A Day at Hamburg Harbour', tagline: 'Big ships, cranes and seagulls.',
    cover: 'A child and a grown-up at the bustling Hamburg harbour with enormous ships, tall cranes, red-brick warehouses and swirling seagulls.',
    scaffold: 'A breezy Hamburg harbour day: enormous ships, tall cranes, a little harbour ferry, cheeky seagulls, and a warm fish roll.',
    beats: ['Enormous ships along the quay', 'A ride on the little harbour ferry', 'Waving at a giant crane', 'Cheeky seagulls after a snack', 'Exploring the red-brick warehouse maze', 'Foghorns as the boats head out'] },
];

async function run(_args: ParsedArgs): Promise<void> {
  const db = createDb();
  const replicate = createReplicate();
  await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

  const { data: stylesData } = await db.from('styles').select('id, style_prompt, reference_image_urls');
  const styles = (stylesData ?? []) as { id: string; style_prompt: string; reference_image_urls: string[] | null }[];
  const styleById = Object.fromEntries(styles.map((s) => [s.id, s]));

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
      if ((fresh as { preview_image_url: string | null } | null)?.preview_image_url) {
        console.log(`  · ${t.id} (preview exists)`);
        continue;
      }

      const style = styleById[t.style] ?? styles[0];
      const out = await replicate.run('google/nano-banana-pro', {
        input: {
          prompt: `Children's picture-book cover illustration (no text, no title, no lettering): ${t.cover} Generic charming characters. Style: ${style.style_prompt}. Reserve a quiet area in the upper third.`,
          aspect_ratio: '1:1', output_format: 'png',
          ...(style.reference_image_urls?.length ? { image_input: style.reference_image_urls.slice(0, 1) } : {}),
        },
      });
      const jpeg = await toJpeg(await fetchBytes(toUrl(out)), `loc-${t.id}`, 900);
      const pub = await upload(db, 'renders', `template-previews/${t.id}.jpg`, jpeg, 'image/jpeg');
      await db.from('story_templates').update({ preview_image_url: pub }).eq('id', t.id);
      console.log(`  ✓ ${t.id} (${t.region}) preview`);
    } catch (err) {
      console.log(`  ✗ ${t.id}: ${String(err).slice(0, 140)}`);
    }
  }
  console.log('Done creating location templates.');
}

export const locationTemplates: Command = {
  name: 'location-templates',
  summary: 'Create the region-tagged "Adventures near you" location templates with preview art.',
  usage: 'location-templates',
  run,
};
