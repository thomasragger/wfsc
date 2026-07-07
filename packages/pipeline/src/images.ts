import Replicate from 'replicate';
import type { CharacterSheet, PersonInput, StyleDef, StorySpread } from './types';

/**
 * Image generation on Replicate (models per July 2026 research):
 * - Character sheets: google/nano-banana-pro (best identity through heavy stylization)
 * - Spreads:          bytedance/seedream-4.5 (multi-reference, native custom sizes, ~$0.04)
 * - Upscale:          recraft-ai/recraft-crisp-upscale (illustration-tuned, restorative)
 * Fallback family:    black-forest-labs/flux-2-pro
 */
const MODELS = {
  characterSheet: (process.env.WFSC_MODEL_CHARACTER ?? 'google/nano-banana-pro') as `${string}/${string}`,
  spread: (process.env.WFSC_MODEL_SPREAD ?? 'bytedance/seedream-4.5') as `${string}/${string}`,
  upscale: (process.env.WFSC_MODEL_UPSCALE ?? 'recraft-ai/recraft-crisp-upscale') as `${string}/${string}`,
};

function client(): Replicate {
  return new Replicate(); // reads REPLICATE_API_TOKEN
}

function firstUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output.length > 0) return String(output[0]);
  if (output && typeof output === 'object' && 'url' in output) {
    const u = (output as { url: unknown }).url;
    return typeof u === 'function' ? String(u.call(output)) : String(u);
  }
  throw new Error(`Unexpected Replicate output shape: ${JSON.stringify(output).slice(0, 200)}`);
}

/** Generate a stylized character turnaround sheet for one person. */
export async function generateCharacterSheet(
  person: PersonInput,
  style: StyleDef,
  replicate: Replicate = client(),
): Promise<{ sheetUrl: string }> {
  const prompt = `Turn the person in the reference photo(s) into a children's picture-book character.
Character turnaround sheet on a plain white background: full-body front view, 3/4 view, side view, and four facial expressions (happy, surprised, laughing, sleepy).
Keep the person's recognizable features (hair, face shape, build, typical clothing) while fully translating them into this illustration style.
Style: ${style.stylePrompt}. No text, no labels, no watermark.`;

  const output = await replicate.run(MODELS.characterSheet, {
    input: {
      prompt,
      image_input: [...person.photoUrls, ...style.referenceImageUrls.slice(0, 2)],
      aspect_ratio: '1:1',
      output_format: 'png',
    },
  });
  return { sheetUrl: firstUrl(output) };
}

export interface SpreadImageRequest {
  spread: Pick<StorySpread, 'illustration_prompt' | 'copy_space' | 'layout'>;
  characters: CharacterSheet[];
  style: StyleDef;
  /** Optional customer adjustment note for regeneration. */
  regenNote?: string;
}

/**
 * Generate one spread illustration. Always called with the SAME fixed inputs
 * (character sheets + style refs) — never chained from a previous page.
 * Square for single-page layouts; 2:1 for full-bleed-overlay.
 */
export async function generateSpreadImage(
  req: SpreadImageRequest,
  replicate: Replicate = client(),
): Promise<{ imageUrl: string }> {
  const { spread, characters, style } = req;
  const isWide = spread.layout === 'full-bleed-overlay';

  const characterIntro = characters
    .map(
      (c, i) =>
        `Image ${i + 1} is the character sheet for ${c.name.toUpperCase()}${c.role ? ` (${c.role})` : ''}: ${c.description}. Draw ${c.name.toUpperCase()} exactly as shown in Image ${i + 1}.`,
    )
    .join('\n');
  const styleRefIndex = characters.length + 1;

  const prompt = `${characterIntro}
Image ${styleRefIndex} shows the illustration style to match exactly.

Scene: ${spread.illustration_prompt}
Reserve quiet, uncluttered copy space: ${spread.copy_space}.
${req.regenNote ? `Adjustment requested: ${req.regenNote}.` : ''}
Style: ${style.stylePrompt}`;

  const output = await replicate.run(MODELS.spread, {
    input: {
      prompt,
      image_input: [
        ...characters.map((c) => c.sheetUrl),
        ...style.referenceImageUrls.slice(0, 1),
      ],
      size: 'custom',
      width: isWide ? 4096 : 2048,
      height: 2048,
      output_format: 'png',
    },
  });
  return { imageUrl: firstUrl(output) };
}

/** Upscale a working-resolution illustration to print resolution. */
export async function upscaleImage(
  imageUrl: string,
  replicate: Replicate = client(),
): Promise<{ imageUrl: string }> {
  const output = await replicate.run(MODELS.upscale, {
    input: { image: imageUrl },
  });
  return { imageUrl: firstUrl(output) };
}
