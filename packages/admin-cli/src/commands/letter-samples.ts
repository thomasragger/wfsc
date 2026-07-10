import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagStr } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes, toJpeg, upload } from '../lib/images.ts';
import { uploadMockupRefs } from '../lib/mockups.ts';
import { stateDir, ensureStateDirs } from '../lib/paths.ts';

/**
 * Localized sample covers. finalize-samples.ts letters the ENGLISH title onto
 * each sample cover and overwrites books.cover_image_url — no title-less
 * original is preserved in a reconstructable path (originals live under
 * samples/<template>/ or restyle/<style>/<id>/, and restyle may have changed
 * the artwork). So we img2img the current lettered cover and REPLACE the
 * English lettering with the translated title, keeping everything else
 * identical, then rebuild the 3D mockup with the same recipe as
 * finalize-samples / letter-titles. The URLs land in
 * books.translations.<locale>.{cover_image_url,mockup_image_url}; localizeRow
 * overlays them for that locale on the sample gallery and viewer.
 */

function colorText(styleId: string): string {
  return styleId === 'crayon'
    ? "Colour the lettering playfully like a child's crayon drawing, letters may be different bright colours."
    : "Use a SINGLE unified colour for the entire title, drawn from the artwork's palette. Do NOT colour individual letters or words differently; at most the colour may change once per line break. The whole headline should read as one cohesive piece of lettering.";
}

interface Progress {
  done: Record<string, { cover?: string; mockup?: string; title?: string }>;
}

async function run(args: ParsedArgs): Promise<void> {
  ensureStateDirs();
  const locale = flagStr(args, 'locale', 'de');
  if (locale === 'en') throw new Error('letter-samples localizes; pass --locale de (en covers come from finalize-samples).');
  const model = flagStr(args, 'model', 'google/nano-banana-pro');

  const PROGRESS = join(stateDir, `letter-samples.${locale}.json`);
  const db = createDb();
  const replicate = createReplicate();
  await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

  const mockupRefUrls = await uploadMockupRefs(db);
  console.log('✓ mockup refs ready');

  let progress: Progress = { done: {} };
  try {
    progress = JSON.parse(await readFile(PROGRESS, 'utf8'));
  } catch {
    progress = { done: {} };
  }
  const saveProgress = () => writeFile(PROGRESS, JSON.stringify(progress, null, 2));

  const { data, error } = await db
    .from('books')
    .select('id, title, style_id, cover_image_url, translations')
    .eq('is_sample', true)
    .order('created_at');
  if (error) throw error;
  type Row = {
    id: string;
    title: string | null;
    style_id: string;
    cover_image_url: string | null;
    translations: Record<string, Record<string, string>> | null;
  };
  const rows = (data ?? []) as Row[];

  // Only books that already have a translated title (translate-samples first).
  const eligible = rows.filter((b) => b.translations?.[locale]?.title?.trim());
  console.log(`▸ lettering ${locale} titles onto ${eligible.length}/${rows.length} sample covers…`);
  if (eligible.length < rows.length) {
    console.log(`  ! ${rows.length - eligible.length} book(s) missing a ${locale} title — run translate-samples --locale ${locale} first.`);
  }

  async function persistUrl(b: Row, field: 'cover_image_url' | 'mockup_image_url', url: string) {
    const merged = {
      ...(b.translations ?? {}),
      [locale]: { ...(b.translations?.[locale] ?? {}), [field]: url },
    };
    const { error: upErr } = await db.from('books').update({ translations: merged }).eq('id', b.id);
    if (upErr) throw new Error(upErr.message);
    b.translations = merged;
  }

  for (const b of eligible) {
    const title = b.translations![locale].title;
    const st = (progress.done[b.id] ??= {});
    try {
      // Re-letter if never done OR the title changed since the last run.
      if (!st.cover || st.title !== title) {
        if (!b.cover_image_url) {
          console.log(`  ! ${b.title}: no cover_image_url, skipping`);
          continue;
        }
        const prompt =
          `This is a finished children's picture-book cover that already has a hand-lettered title on it. ` +
          `REPLACE that existing title lettering with a new title, and change NOTHING else: keep the illustration, characters, colours, framing, composition and the exact lettering style, medium, placement and decorative flourishes identical. ` +
          `Remove every word of the old title cleanly and letter the new title in its place, in the same art medium and texture as the artwork so it reads as painted into the scene. ` +
          `${colorText(b.style_id)} ` +
          `The new title MUST read EXACTLY, spelled letter-for-letter including any umlauts or accents (ä ö ü ß): "${title}", do not invent, rename, shorten, translate or add any other words, and do NOT carry over apostrophes or any other punctuation from the old title unless it appears in the new title. ` +
          `Arrange the words in natural reading order so the whole title reads as one continuous phrase, left-to-right then top-to-bottom; never scatter the words out of order. Keep it clearly legible.`;
        const out = await replicate.run(model, {
          input: { prompt, image_input: [b.cover_image_url], aspect_ratio: '1:1', output_format: 'png' },
        });
        const jpeg = await toJpeg(await fetchBytes(toUrl(out)), `sc-${locale}-${b.id}`, 1100, 84);
        const pub = await upload(db, 'renders', `sample-covers-titled/${b.id}.${locale}.jpg`, jpeg, 'image/jpeg');
        st.cover = pub;
        st.title = title;
        st.mockup = undefined;
        await persistUrl(b, 'cover_image_url', pub);
        await saveProgress();
        console.log(`  ✓ ${title} — cover (${(jpeg.length / 1024).toFixed(0)}KB)`);
      }

      if (!st.mockup && st.cover) {
        const out = await replicate.run(model, {
          input: {
            prompt:
              "Recreate this exact children's book cover illustration as a professional product photograph: a real square hardcover book at a gentle 3/4 angle on a warm beige studio backdrop, spine on the left, soft realistic shadow, subtle page edges, natural studio lighting. Match the photographic style, angle, backdrop and lighting of the two reference photos exactly. Reproduce the cover artwork faithfully including the title lettering; do not redraw or reinterpret it.",
            image_input: [st.cover, ...mockupRefUrls],
            aspect_ratio: '1:1',
            output_format: 'png',
          },
        });
        const jpeg = await toJpeg(await fetchBytes(toUrl(out)), `sm-${locale}-${b.id}`, 900, 84);
        const pub = await upload(db, 'renders', `sample-mockups/${b.id}.${locale}.jpg`, jpeg, 'image/jpeg');
        st.mockup = pub;
        await persistUrl(b, 'mockup_image_url', pub);
        await saveProgress();
        console.log(`  ✓ ${title} — mockup (${(jpeg.length / 1024).toFixed(0)}KB)`);
      }
    } catch (err) {
      console.log(`  ✗ ${b.title} (${title}): ${String(err).slice(0, 160)}`);
    }
  }
  console.log('Done lettering sample covers.');
}

export const letterSamples: Command = {
  name: 'letter-samples',
  summary: 'Re-letter sample covers with the translated title and rebuild the 3D mockup into translations.<locale> (resumable).',
  usage: 'letter-samples [--locale de] [--model google/nano-banana-pro]',
  run,
};
