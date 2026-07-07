export type SpreadKind = 'cover' | 'greeting' | 'story';

export type LayoutId =
  | 'text-left' // text on left page, full-bleed illustration on right (classic)
  | 'text-right' // mirrored
  | 'full-bleed-overlay' // illustration across both pages, text overlaid in copy space
  | 'text-bottom'; // illustration on top two-thirds, text band below

export interface SpreadData {
  id: string;
  position: number;
  kind: SpreadKind;
  text: string | null;
  layout: LayoutId;
  /** Working-resolution illustration URL (preview). */
  imageUrl: string | null;
  /** Print-resolution illustration URL (300dpi + bleed). */
  printImageUrl: string | null;
}

export interface BookData {
  id: string;
  title: string;
  greeting: string | null;
  fontPairing: FontPairingId;
  styleId: string;
  spreads: SpreadData[];
  coverImageUrl: string | null;
  coverPrintImageUrl: string | null;
  /** Logo for the title/closing pages; defaults to the hosted WFSC logo. */
  logoUrl?: string | null;
  /** Names of the people in the story, for the title-page byline. */
  peopleNames?: string[];
}

export type FontPairingId =
  | 'storybook'
  | 'classic'
  | 'elegant'
  | 'playful'
  | 'handwritten';

export interface FontPairing {
  id: FontPairingId;
  name: string;
  /** Display font for title/cover/headings. */
  display: FontSpec;
  /** Body font for story text. */
  body: FontSpec;
}

export interface FontSpec {
  family: string;
  /** Google Fonts family query, e.g. 'Baloo+2:wght@600'. All OFL-licensed (print-embeddable). */
  googleFamily: string;
  weight: number;
}
