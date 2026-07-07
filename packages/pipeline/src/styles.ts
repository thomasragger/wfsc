import type { StyleDef } from './types';

/**
 * Built-in style prompts. Single source of truth for prompts is the DB
 * (supabase/seed.sql seeds the same content); this copy exists so the CLI
 * harness can run without a database. Keep the two in sync when editing.
 */
export const BUILTIN_STYLES: Record<string, Omit<StyleDef, 'referenceImageUrls'>> = {
  'flat-vector': {
    id: 'flat-vector',
    stylePrompt:
      "flat vector naive children's-book illustration, bold simple geometric shapes, thick uneven hand-drawn outlines, warm limited palette of coral red, marigold yellow, cobalt blue and sage green, subtle textured paper grain, cheerful rounded characters with rosy cheeks and dot eyes, no gradients, no photorealism, no text",
  },
  watercolor: {
    id: 'watercolor',
    stylePrompt:
      "gentle watercolor children's-book illustration, soft translucent washes, delicate pencil linework, muted pastel palette with warm sunlight, visible paper texture, loose expressive brush strokes, tender storybook atmosphere, no hard outlines, no photorealism, no text",
  },
  'riso-print': {
    id: 'riso-print',
    stylePrompt:
      "risograph screen-print style children's-book illustration, grainy overlapping ink layers, limited palette of fluorescent coral, teal blue and sunflower yellow, visible print misregistration, bold simplified shapes, flat perspective, retro playful energy, no gradients, no photorealism, no text",
  },
  crayon: {
    id: 'crayon',
    stylePrompt:
      "children's crayon drawing style illustration, waxy textured crayon strokes, wobbly endearing hand-drawn lines, bright primary colors on warm off-white paper, visible scribble fills that escape the lines, childlike joyful energy, naive proportions, no photorealism, no text",
  },
  'mid-century': {
    id: 'mid-century',
    stylePrompt:
      "mid-century vintage children's-book illustration, textured gouache paint, stylized rounded characters, nostalgic palette of mustard, dusty rose, teal and cream, subtle halftone shading, 1950s picture-book charm, slightly flattened perspective, no photorealism, no text",
  },
};
