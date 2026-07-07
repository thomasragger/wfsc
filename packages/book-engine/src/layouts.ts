import type { LayoutId } from './types';

export interface LayoutDef {
  id: LayoutId;
  name: string;
  description: string;
  /** Which page of the pair carries the text (for page-splitting in print). */
  textPage: 'left' | 'right' | 'overlay' | 'bottom';
}

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  'text-left': {
    id: 'text-left',
    name: 'Text left',
    description: 'Story text on the left page, full illustration on the right.',
    textPage: 'left',
  },
  'text-right': {
    id: 'text-right',
    name: 'Text right',
    description: 'Full illustration on the left page, story text on the right.',
    textPage: 'right',
  },
  'full-bleed-overlay': {
    id: 'full-bleed-overlay',
    name: 'Full spread',
    description: 'Illustration across both pages, text set into the quiet area.',
    textPage: 'overlay',
  },
  'text-bottom': {
    id: 'text-bottom',
    name: 'Text below',
    description: 'Illustration on top, a calm text band along the bottom.',
    textPage: 'bottom',
  },
};

export const DEFAULT_LAYOUT: LayoutId = 'text-left';
