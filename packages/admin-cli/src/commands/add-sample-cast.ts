import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagStr } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes, toJpeg, upload } from '../lib/images.ts';
import { sampleConfigsDir } from '../lib/paths.ts';

// template id -> sample config basename (the generated dir + config share it).
const TEMPLATE_TO_CFG: Record<string, string> = {
  'beach-treasure': 's-beach-treasure',
  'dads-tiny-toolbox-helper': 's-dads-toolbox',
  'whale-watching': 's-whale-watching',
  'golf-with-grandpa': 's-golf-grandpa',
  'grandmas-garden-of-seasons': 's-grandmas-garden',
  'rainy-day-fort': 's-rainy-day-fort',
};

interface SampleConfig {
  people: { name: string; role?: string; appearance: string }[];
}

async function run(args: ParsedArgs): Promise<void> {
  const since = flagStr(args, 'since');
  const db = createDb();
  const replicate = createReplicate();
  await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

  let query = db.from('books').select('id, title, template_id').eq('is_sample', true);
  if (since) query = query.gte('created_at', since);
  const { data: samples } = await query;

  for (const book of ((samples ?? []) as { id: string; title: string; template_id: string }[])) {
    const cfgName = TEMPLATE_TO_CFG[book.template_id];
    if (!cfgName) {
      console.log(`- skip ${book.title} (no config map)`);
      continue;
    }
    const cfg = JSON.parse(await readFile(join(sampleConfigsDir, `${cfgName}.json`), 'utf8')) as SampleConfig;
    const { data: existing } = await db.from('book_people').select('name').eq('book_id', book.id);
    const have = new Set(((existing ?? []) as { name: string }[]).map((p) => p.name));

    for (const [i, person] of cfg.people.entries()) {
      if (have.has(person.name)) {
        console.log(`  · ${book.title} / ${person.name} (exists)`);
        continue;
      }
      try {
        // 1. Believable input photo from the description.
        const photoPrompt =
          `A warm, candid real-life photograph of ${person.appearance}. ` +
          `Natural soft lighting, plain simple background, gentle smile, looking toward the camera, ` +
          `everyday smartphone snapshot, photorealistic, head-and-shoulders.`;
        const pOut = await replicate.run('google/nano-banana-pro', {
          input: { prompt: photoPrompt, aspect_ratio: '1:1', output_format: 'png' },
        });
        const photoUrl = await upload(
          db,
          'renders',
          `sample-cast/${book.id}/${person.name.toLowerCase()}-photo.jpg`,
          await toJpeg(await fetchBytes(toUrl(pOut)), `cast-p-${book.id}-${i}`, 700),
          'image/jpeg',
        );

        // 2. The real character sheet from generation (local sheets/ dir).
        const sheetLocal = join(sampleConfigsDir, `generated-${cfgName}`, 'sheets', `${person.name.toLowerCase()}.png`);
        const sheetUrl = await upload(
          db,
          'renders',
          `sample-cast/${book.id}/${person.name.toLowerCase()}-sheet.jpg`,
          await toJpeg(await readFile(sheetLocal), `cast-s-${book.id}-${i}`, 900),
          'image/jpeg',
        );

        await db.from('book_people').insert({
          book_id: book.id,
          name: person.name,
          role: person.role ?? null,
          photo_urls: [photoUrl],
          character_sheet_url: sheetUrl,
          character_description: person.appearance,
          approved: true,
          sort_order: i,
        });
        console.log(`  ✓ ${book.title} / ${person.name}`);
      } catch (err) {
        console.log(`  ✗ ${book.title} / ${person.name}: ${String(err).slice(0, 140)}`);
      }
    }
  }
  console.log('Done adding sample cast.');
}

export const addSampleCast: Command = {
  name: 'add-sample-cast',
  summary: 'Give each sample book a visible cast (synthetic input photo + character sheet).',
  usage: 'add-sample-cast [--since <YYYY-MM-DD>]',
  run,
};
