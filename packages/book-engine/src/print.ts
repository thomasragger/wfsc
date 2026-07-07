/**
 * Print geometry for the v1 format: Lulu square 8.5×8.5 in casewrap.
 * Interior PDF is single pages at trim + 0.125 in bleed per edge, sRGB.
 */
export const PRINT = {
  dpi: 300,
  trimIn: 8.5,
  bleedIn: 0.125,
  /** Single interior page including bleed, in inches. */
  pageIn: 8.5 + 2 * 0.125,
  /** Single interior page including bleed, in pixels at 300dpi (2625×2625). */
  pagePx: Math.round((8.5 + 2 * 0.125) * 300),
  /** Illustration spread (2 pages side by side) incl. bleed, px (5250×2625). */
  spreadPx: {
    width: Math.round((8.5 + 2 * 0.125) * 300) * 2,
    height: Math.round((8.5 + 2 * 0.125) * 300),
  },
  /** Safe margin from trim edge for text, in inches. */
  safeMarginIn: 0.5,
  /** Interior page count (Lulu casewrap minimum is 24; 32 keeps vendor portability). */
  interiorPages: 32,
} as const;

/** Generation size for seedream spreads (upscaled ~1.28× to print size). */
export const GEN_SPREAD = { width: 4096, height: 2048 } as const;
