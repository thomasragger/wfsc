import { z } from 'zod';

export const StorySpreadSchema = z.object({
  /** Story text for the text page (2-4 sentences, read-aloud friendly). */
  text: z.string(),
  /** Scene description for the image model. No character appearance details here. */
  illustration_prompt: z.string(),
  /** Where quiet copy space should be reserved, e.g. 'soft sky, upper third'. */
  copy_space: z.string(),
  /** Layout suggestion. */
  layout: z.enum(['text-left', 'text-right', 'full-bleed-overlay', 'text-bottom']).default('text-left'),
});

export const StorySchema = z.object({
  title: z.string(),
  /** One-line cover illustration prompt. */
  cover_prompt: z.string(),
  spreads: z.array(StorySpreadSchema).min(10).max(16),
});

export type Story = z.infer<typeof StorySchema>;
export type StorySpread = z.infer<typeof StorySpreadSchema>;

export interface PersonInput {
  name: string;
  role?: string;
  /** Public URLs or data URIs of the uploaded photos. */
  photoUrls: string[];
}

export interface CharacterSheet {
  name: string;
  role?: string;
  /** URL of the generated turnaround sheet. */
  sheetUrl: string;
  /** Appearance lock, used verbatim in every spread prompt. */
  description: string;
}

export interface StyleDef {
  id: string;
  /** Locked style paragraph appended verbatim to every image prompt. */
  stylePrompt: string;
  /** Style reference image URLs passed to the image model with every call. */
  referenceImageUrls: string[];
}

export interface QaVerdict {
  score: number; // 0-100
  pass: boolean;
  notes: string;
}
