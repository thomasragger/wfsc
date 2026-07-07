import type { FontPairing, FontPairingId } from './types';

/**
 * Curated font pairings. All families are OFL-licensed via Google Fonts, so
 * embedding in the print PDF is unrestricted.
 */
export const FONT_PAIRINGS: Record<FontPairingId, FontPairing> = {
  storybook: {
    id: 'storybook',
    name: 'Storybook',
    display: { family: 'Baloo 2', googleFamily: 'Baloo+2:wght@700', weight: 700 },
    body: { family: 'Quicksand', googleFamily: 'Quicksand:wght@500', weight: 500 },
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    display: { family: 'Literata', googleFamily: 'Literata:wght@600', weight: 600 },
    body: { family: 'Literata', googleFamily: 'Literata:wght@400', weight: 400 },
  },
  elegant: {
    id: 'elegant',
    name: 'Elegant',
    display: { family: 'Playfair Display', googleFamily: 'Playfair+Display:wght@600', weight: 600 },
    body: { family: 'Source Sans 3', googleFamily: 'Source+Sans+3:wght@400', weight: 400 },
  },
  playful: {
    id: 'playful',
    name: 'Playful',
    display: { family: 'Fredoka', googleFamily: 'Fredoka:wght@600', weight: 600 },
    body: { family: 'Nunito', googleFamily: 'Nunito:wght@500', weight: 500 },
  },
  handwritten: {
    id: 'handwritten',
    name: 'Handwritten',
    display: { family: 'Caveat', googleFamily: 'Caveat:wght@700', weight: 700 },
    body: { family: 'Quicksand', googleFamily: 'Quicksand:wght@500', weight: 500 },
  },
};

/** Script face used for the personalized dedication (Widmung), independent of pairing. */
export const SCRIPT_FONT = { family: 'Caveat', googleFamily: 'Caveat:wght@700', weight: 700 } as const;

export function fontStylesheetUrl(pairing: FontPairing): string {
  const families = new Set([
    pairing.display.googleFamily,
    pairing.body.googleFamily,
    SCRIPT_FONT.googleFamily,
  ]);
  const query = [...families].map((f) => `family=${f}`).join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
