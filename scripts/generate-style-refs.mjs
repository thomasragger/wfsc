/**
 * Stage 0: generate the curated style reference packs (one-time per style).
 * For each style in the DB: render 3 generic scenes with nano-banana-pro,
 * upload to Supabase Storage (style-refs bucket, public), update
 * styles.reference_image_urls, and save local copies for the CLI harness
 * under packages/pipeline/style-refs/<style-id>/.
 *
 * Scene choice matters: includes a SEA scene because water reliably drags
 * image models toward painterly rendering — the pack must anchor water done
 * in-style. Run: node --env-file=.env scripts/generate-style-refs.mjs [styleId]
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SCENES = [
  { key: 'park', prompt: 'a mother and a small child having a picnic under a big tree in a sunny park, a red kite in the sky' },
  { key: 'sea', prompt: 'two people in a small wooden boat on the open sea, big friendly waves, clouds and seagulls, a whale tail in the distance' },
  { key: 'cozy', prompt: 'a cozy bedtime scene, a parent reading to a child in a warmly lit bedroom with toys on the floor' },
];

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const replicate = new Replicate();
const onlyStyle = process.argv[2];

const { data: styles, error } = await db.from('styles').select('id, style_prompt');
if (error) throw error;

await db.storage.createBucket('style-refs', { public: true }).catch(() => undefined);

for (const style of styles.filter((s) => !onlyStyle || s.id === onlyStyle)) {
  const urls = [];
  const localDir = join('packages/pipeline/style-refs', style.id);
  await mkdir(localDir, { recursive: true });

  for (const scene of SCENES) {
    console.log(`▸ ${style.id} / ${scene.key}…`);
    const prompt = `Children's picture-book illustration: ${scene.prompt}.
Style: ${style.style_prompt}.
This image will be used as a style reference; the style must be pure and consistent across the whole image. Absolutely no text, letters or watermark.`;
    const output = await replicate.run('google/nano-banana-pro', {
      input: { prompt, aspect_ratio: '1:1', output_format: 'png' },
    });
    const url = typeof output === 'string' ? output : Array.isArray(output) ? String(output[0]) : String(output.url?.() ?? output.url);
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());

    const storagePath = `${style.id}/${scene.key}.png`;
    const { error: upErr } = await db.storage
      .from('style-refs')
      .upload(storagePath, bytes, { contentType: 'image/png', upsert: true });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);
    const { data: pub } = db.storage.from('style-refs').getPublicUrl(storagePath);
    urls.push(pub.publicUrl);
    await writeFile(join(localDir, `${scene.key}.png`), bytes);
  }

  const { error: updErr } = await db.from('styles').update({ reference_image_urls: urls }).eq('id', style.id);
  if (updErr) throw updErr;
  console.log(`✓ ${style.id}: ${urls.length} refs saved`);
}
console.log('Done.');
