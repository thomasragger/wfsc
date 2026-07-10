import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Replicate from 'replicate';
import { assetsDir } from './paths.ts';
import { toUrl, fetchBytes, upload } from './images.ts';

// Reference product photos (warm beige backdrop, 3/4 angle, visible spine) that
// steer nano-banana-pro when turning a flat cover into a 3D book shot. These
// live in the machine-local assets bundle; override the filenames if needed.
const MOCKUP_REF_DIR = process.env.WFSC_MOCKUP_REF_DIR ?? join(assetsDir, 'book-mockups');
const MOCKUP_REF_FILES = (
  process.env.WFSC_MOCKUP_REF_FILES ??
  'Gemini_Generated_Image_aeutghaeutghaeut.png,Gemini_Generated_Image_txk4yhtxk4yhtxk4.png'
)
  .split(',')
  .map((f) => f.trim())
  .filter(Boolean);

export const MOCKUP_PROMPT =
  "Recreate this exact children's book cover illustration as a professional product photograph: a real square hardcover book photographed at a gentle 3/4 angle on a warm beige studio backdrop, spine visible on the left, soft realistic shadow beneath, subtle page edges, natural studio lighting. Match the photographic style, angle, backdrop and lighting of the two reference photos exactly. Reproduce the cover artwork faithfully on the book prop, including any title lettering; do not redraw or reinterpret it.";

/** Upload the mockup reference photos once and return their public URLs. */
export async function uploadMockupRefs(db: SupabaseClient): Promise<string[]> {
  const urls: string[] = [];
  for (const file of MOCKUP_REF_FILES) {
    const bytes = await readFile(join(MOCKUP_REF_DIR, file));
    const path = `style-refs/book-mockup/${file}`;
    urls.push(await upload(db, 'renders', path, bytes, 'image/png'));
  }
  return urls;
}

/** Render a 3D book mockup from a flat cover and return raw PNG bytes. */
export async function renderMockup(
  replicate: Replicate,
  coverUrl: string,
  refUrls: string[],
): Promise<Buffer> {
  const out = await replicate.run('google/nano-banana-pro', {
    input: { prompt: MOCKUP_PROMPT, image_input: [coverUrl, ...refUrls], aspect_ratio: '1:1', output_format: 'png' },
  });
  return fetchBytes(toUrl(out));
}
