import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes, toJpeg, upload } from '../lib/images.ts';
import { uploadMockupRefs } from '../lib/mockups.ts';
import { stateDir, ensureStateDirs } from '../lib/paths.ts';

interface Progress {
  done: Record<string, { titledPreview?: string; colorRule?: string; mockup?: string | null }>;
}

function colorInstruction(styleId: string): { key: string; text: string } {
  if (styleId === 'crayon') {
    return {
      key: 'crayon',
      text: "Colour the lettering playfully like a child's crayon drawing, letters may be different bright colours.",
    };
  }
  return {
    key: 'unified',
    text: "Use a SINGLE unified colour for the entire title, drawn from the artwork's palette. Do NOT colour individual letters or words differently; at most the colour may change once per line break. The whole headline should read as one cohesive piece of lettering.",
  };
}

async function run(_args: ParsedArgs): Promise<void> {
  ensureStateDirs();
  const PROGRESS = join(stateDir, 'letter-template-titles.json');
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

  const { data: templates, error } = await db
    .from('story_templates')
    .select('id, title, preview_image_url, suggested_style_id')
    .not('preview_image_url', 'is', null)
    .order('sort_order');
  if (error) throw error;
  const rows = (templates ?? []) as { id: string; title: string; preview_image_url: string; suggested_style_id: string }[];
  console.log(`▸ lettering titles onto ${rows.length} templates…`);

  // The canonical title-LESS preview so re-runs letter clean art, not the DB
  // column we overwrite. Originals live at template-previews/{id}.{jpg,png}.
  async function originalPreviewUrl(t: { id: string; preview_image_url: string }): Promise<string> {
    for (const ext of ['jpg', 'png']) {
      const url = db.storage.from('renders').getPublicUrl(`template-previews/${t.id}.${ext}`).data.publicUrl;
      const res = await fetch(url, { method: 'HEAD' }).catch(() => null);
      if (res?.ok) return url;
    }
    return t.preview_image_url;
  }

  for (const t of rows) {
    const st = (progress.done[t.id] ??= {});
    const color = colorInstruction(t.suggested_style_id);
    try {
      if (!st.titledPreview || st.colorRule !== color.key) {
        const src = await originalPreviewUrl(t);
        const prompt =
          `Add the book title to this children's picture-book cover, integrated naturally into the illustration as though it were painted as part of the scene, NOT as a caption sitting in a blank band. ` +
          `Render it as large hand-lettering in the SAME art medium and texture as the artwork, arranged across the top of the composition but overlapping and interacting with the scene: let sky, clouds, foliage, stars or other background elements weave around and behind the letters, and add a few small decorative flourishes (doodles, swirls, a hand-drawn underline) that tie the lettering into the picture so the whole cover reads as one artwork. ` +
          `${color.text} ` +
          `The title MUST read EXACTLY, spelled letter-for-letter: "${t.title}", do not invent, rename, shorten, translate, or add any other words. ` +
          `Keep the characters, colours, framing and overall composition intact; only add the integrated title lettering, and keep it clearly legible.`;
        const out = await replicate.run('google/nano-banana-pro', {
          input: { prompt, image_input: [src], aspect_ratio: '1:1', output_format: 'png' },
        });
        const jpeg = await toJpeg(await fetchBytes(toUrl(out)), `tt-prev-${t.id}`, 900);
        const pub = await upload(db, 'renders', `template-previews-titled/${t.id}.jpg`, jpeg, 'image/jpeg');
        st.titledPreview = pub;
        st.colorRule = color.key;
        st.mockup = null;
        await db.from('story_templates').update({ preview_image_url: pub }).eq('id', t.id);
        await saveProgress();
        console.log(`  ✓ ${t.id} titled preview (${color.key}, ${(jpeg.length / 1024).toFixed(0)}KB)`);
      }

      if (!st.mockup) {
        const prompt =
          "Recreate this exact children's book cover illustration as a professional product photograph: a real square hardcover book photographed at a gentle 3/4 angle on a warm beige studio backdrop, spine visible on the left, soft realistic shadow beneath, subtle page edges, natural studio lighting. Match the photographic style, angle, backdrop and lighting of the two reference photos exactly. Reproduce the cover artwork faithfully on the book prop, including the title lettering; do not redraw or reinterpret it.";
        const out = await replicate.run('google/nano-banana-pro', {
          input: { prompt, image_input: [st.titledPreview, ...mockupRefUrls], aspect_ratio: '1:1', output_format: 'png' },
        });
        const jpeg = await toJpeg(await fetchBytes(toUrl(out)), `tt-mock-${t.id}`, 800);
        const pub = await upload(db, 'renders', `template-mockups-titled/${t.id}.jpg`, jpeg, 'image/jpeg');
        st.mockup = pub;
        await db.from('story_templates').update({ mockup_image_url: pub }).eq('id', t.id);
        await saveProgress();
        console.log(`  ✓ ${t.id} mockup (${(jpeg.length / 1024).toFixed(0)}KB)`);
      }
    } catch (err) {
      console.log(`  ✗ ${t.id} (${t.title}): ${String(err).slice(0, 140)}`);
    }
  }
  console.log('Done lettering template titles.');
}

export const letterTitles: Command = {
  name: 'letter-titles',
  summary: 'Letter each template title onto its preview and rebuild the 3D mockup (resumable).',
  usage: 'letter-titles',
  run,
};
