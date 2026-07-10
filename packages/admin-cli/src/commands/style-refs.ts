import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes } from '../lib/images.ts';
import { repoRoot } from '../lib/paths.ts';

const SCENES = [
  { key: 'park', prompt: 'a mother and a small child having a picnic under a big tree in a sunny park, a red kite in the sky' },
  { key: 'sea', prompt: 'two people in a small wooden boat on the open sea, big friendly waves, clouds and seagulls, a whale tail in the distance' },
  { key: 'cozy', prompt: 'a cozy bedtime scene, a parent reading to a child in a warmly lit bedroom with toys on the floor' },
];

async function run(args: ParsedArgs): Promise<void> {
  const onlyStyle = args.positionals[0];
  const db = createDb();
  const replicate = createReplicate();

  const { data: stylesData, error } = await db.from('styles').select('id, style_prompt');
  if (error) throw error;
  const styles = (stylesData ?? []) as { id: string; style_prompt: string }[];

  await db.storage.createBucket('style-refs', { public: true }).catch(() => undefined);

  for (const style of styles.filter((s) => !onlyStyle || s.id === onlyStyle)) {
    const urls: string[] = [];
    const localDir = join(repoRoot, 'packages', 'pipeline', 'style-refs', style.id);
    await mkdir(localDir, { recursive: true });

    for (const scene of SCENES) {
      console.log(`▸ ${style.id} / ${scene.key}…`);
      const prompt = `Children's picture-book illustration: ${scene.prompt}.
Style: ${style.style_prompt}.
This image will be used as a style reference; the style must be pure and consistent across the whole image. Absolutely no text, letters or watermark.`;
      const output = await replicate.run('google/nano-banana-pro', {
        input: { prompt, aspect_ratio: '1:1', output_format: 'png' },
      });
      const bytes = await fetchBytes(toUrl(output));
      const storagePath = `${style.id}/${scene.key}.png`;
      const { error: upErr } = await db.storage.from('style-refs').upload(storagePath, bytes, { contentType: 'image/png', upsert: true });
      if (upErr) throw new Error(`upload failed: ${upErr.message}`);
      urls.push(db.storage.from('style-refs').getPublicUrl(storagePath).data.publicUrl);
      await writeFile(join(localDir, `${scene.key}.png`), bytes);
    }

    const { error: updErr } = await db.from('styles').update({ reference_image_urls: urls }).eq('id', style.id);
    if (updErr) throw updErr;
    console.log(`✓ ${style.id}: ${urls.length} refs saved`);
  }
  console.log('Done.');
}

export const styleRefs: Command = {
  name: 'style-refs',
  summary: 'Generate the curated style reference packs and store them (one-time per style).',
  usage: 'style-refs [styleId]',
  run,
};
