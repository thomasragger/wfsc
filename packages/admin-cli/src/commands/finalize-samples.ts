import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagBool, flagStr } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes, toJpeg, upload } from '../lib/images.ts';
import { uploadMockupRefs } from '../lib/mockups.ts';

function colorText(styleId: string): string {
  return styleId === 'crayon'
    ? "Colour the lettering playfully like a child's crayon drawing, letters may be different bright colours."
    : "Use a SINGLE unified colour for the entire title, drawn from the artwork's palette. Do NOT colour individual letters or words differently; at most the colour may change once per line break. The whole headline should read as one cohesive piece of lettering.";
}

async function run(args: ParsedArgs): Promise<void> {
  const since = flagStr(args, 'since');
  if (!since) {
    throw new Error('Pass --since <YYYY-MM-DD>: the date the new sample batch was created (was the hardcoded CUTOFF).');
  }
  const prune = flagBool(args, 'prune');

  const db = createDb();
  const replicate = createReplicate();
  await db.storage.createBucket('renders', { public: true }).catch(() => undefined);
  const mockupRefUrls = await uploadMockupRefs(db);

  const { data: samplesData, error } = await db
    .from('books')
    .select('id, title, cover_image_url, style_id, cover_has_title, mockup_image_url, created_at')
    .eq('is_sample', true)
    .gte('created_at', since)
    .order('created_at');
  if (error) throw error;
  const samples = (samplesData ?? []) as {
    id: string;
    title: string;
    cover_image_url: string | null;
    style_id: string;
    cover_has_title: boolean;
    mockup_image_url: string | null;
  }[];
  console.log(`▸ finalizing ${samples.length} new samples…`);

  for (const b of samples) {
    try {
      if (!b.cover_has_title && b.cover_image_url) {
        const prompt =
          `Add the book title to this children's picture-book cover, integrated naturally into the illustration as though painted as part of the scene, NOT a caption in a blank band. ` +
          `Render it as large hand-lettering in the SAME art medium and texture as the artwork, across the top of the composition, letting background elements weave around the letters, with a few small decorative flourishes tying it into the picture. ` +
          `${colorText(b.style_id)} ` +
          `The title MUST read EXACTLY, letter-for-letter: "${b.title}", do not invent, rename, shorten, translate or add words. ` +
          `Arrange the words in natural reading order so the whole title reads as one continuous phrase, left-to-right then top-to-bottom; never scatter the words out of order. ` +
          `Keep the characters, colours, framing and composition intact; only add the integrated title lettering, clearly legible.`;
        const out = await replicate.run('google/nano-banana-pro', {
          input: { prompt, image_input: [b.cover_image_url], aspect_ratio: '1:1', output_format: 'png' },
        });
        const jpeg = await toJpeg(await fetchBytes(toUrl(out)), `sc-${b.id}`, 1100, 84);
        b.cover_image_url = await upload(db, 'renders', `sample-covers-titled/${b.id}.jpg`, jpeg, 'image/jpeg');
        b.mockup_image_url = null;
        await db.from('books').update({ cover_image_url: b.cover_image_url, cover_has_title: true }).eq('id', b.id);
        console.log(`  ✓ ${b.title}, titled cover`);
      }

      if (!b.mockup_image_url && b.cover_image_url) {
        const out = await replicate.run('google/nano-banana-pro', {
          input: {
            prompt:
              "Recreate this exact children's book cover illustration as a professional product photograph: a real square hardcover book at a gentle 3/4 angle on a warm beige studio backdrop, spine on the left, soft realistic shadow, subtle page edges, natural studio lighting. Match the photographic style, angle, backdrop and lighting of the two reference photos exactly. Reproduce the cover artwork faithfully including the title lettering; do not redraw or reinterpret it.",
            image_input: [b.cover_image_url, ...mockupRefUrls],
            aspect_ratio: '1:1',
            output_format: 'png',
          },
        });
        const jpeg = await toJpeg(await fetchBytes(toUrl(out)), `sm-${b.id}`, 900, 84);
        const pub = await upload(db, 'renders', `sample-mockups/${b.id}.jpg`, jpeg, 'image/jpeg');
        await db.from('books').update({ mockup_image_url: pub }).eq('id', b.id);
        console.log(`  ✓ ${b.title}, mockup`);
      }
    } catch (err) {
      console.log(`  ✗ ${b.title}: ${String(err).slice(0, 140)}`);
    }
  }

  // Prune the previous generation of samples, guarded and opt-in.
  if (prune && samples.length >= 6) {
    const { data: old } = await db.from('books').select('id, title').eq('is_sample', true).lt('created_at', since);
    for (const o of (old ?? []) as { id: string; title: string }[]) {
      await db.from('books').delete().eq('id', o.id);
      console.log(`  - pruned old sample: ${o.title}`);
    }
  } else if (prune) {
    console.log(`  ! only ${samples.length} new samples, skipping prune of old ones for safety`);
  }
  console.log('Done finalizing samples.');
}

export const finalizeSamples: Command = {
  name: 'finalize-samples',
  summary: 'Letter titles onto new sample covers, build 3D mockups, optionally prune old samples.',
  usage: 'finalize-samples --since <YYYY-MM-DD> [--prune]',
  run,
};
