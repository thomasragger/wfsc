import { FONT_PAIRINGS, fontStylesheetUrl } from './fonts';
import { PRINT } from './print';
import type { BookData, SpreadData } from './types';

/**
 * HTML rendering shared by the web preview (iframe) and the print renderer
 * (headless Chromium). Pages are sized in physical inches so Chromium's PDF
 * output is dimensionally exact (trim + bleed).
 *
 * Illustration aspect follows layout: single-page layouts (text-left,
 * text-right, text-bottom) use square images; 'full-bleed-overlay' uses a 2:1
 * spread image. Switching between text-left/text-right/text-bottom in the
 * editor is free; switching to/from full-bleed-overlay requires regeneration.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const textToParagraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('');

function baseCss(book: BookData): string {
  const pairing = FONT_PAIRINGS[book.fontPairing];
  const page = PRINT.pageIn;
  const safe = PRINT.bleedIn + PRINT.safeMarginIn;
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${page}in ${page}in; margin: 0; }
    html, body { width: ${page}in; height: ${page}in; }
    body {
      font-family: '${pairing.body.family}', serif;
      font-weight: ${pairing.body.weight};
      color: #2b2320;
      background: #fffdf8;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { position: relative; width: ${page}in; height: ${page}in; overflow: hidden; }
    .illustration {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
    }
    .text-block {
      position: absolute;
      inset: ${safe}in;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center;
      font-size: 19pt; line-height: 1.65;
    }
    .text-block p + p { margin-top: 0.75em; }
    .display {
      font-family: '${pairing.display.family}', cursive;
      font-weight: ${pairing.display.weight};
    }
    .overlay-text {
      position: absolute;
      left: ${safe}in; right: ${safe}in; top: ${safe}in;
      height: 33%;
      display: flex; align-items: center; justify-content: center;
      text-align: center; font-size: 18pt; line-height: 1.6;
      color: #2b2320;
      text-shadow: 0 0 14px rgba(255, 253, 248, 0.9), 0 0 4px rgba(255, 253, 248, 0.9);
    }
    .band-illustration { position: absolute; top: 0; left: 0; right: 0; height: 68%; object-fit: cover; width: 100%; }
    .band-text {
      position: absolute; left: ${safe}in; right: ${safe}in; bottom: ${safe}in;
      height: calc(30% - ${safe}in);
      display: flex; align-items: center; justify-content: center;
      text-align: center; font-size: 17pt; line-height: 1.6;
    }
    .greeting { font-size: 21pt; font-style: italic; line-height: 1.8; }
    .title-page-title { font-size: 42pt; line-height: 1.2; }
  `;
}

function doc(book: BookData, bodyHtml: string): string {
  const pairing = FONT_PAIRINGS[book.fontPairing];
  return `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="${fontStylesheetUrl(pairing)}"/>
<style>${baseCss(book)}</style>
</head><body>${bodyHtml}</body></html>`;
}

export interface RenderedPage {
  /** Full HTML document for one physical page (trim + bleed). */
  html: string;
  side: 'left' | 'right';
}

/**
 * Render one spread into its two physical pages, according to its layout.
 * `forPrint` selects print-resolution image URLs.
 */
export function renderSpreadPages(book: BookData, spread: SpreadData, forPrint = false): RenderedPage[] {
  const img = escapeHtml((forPrint ? spread.printImageUrl : spread.imageUrl) ?? '');
  const text = spread.text ?? '';

  if (spread.kind === 'greeting') {
    return [
      { side: 'left', html: doc(book, `<div class="page"></div>`) },
      {
        side: 'right',
        html: doc(
          book,
          `<div class="page"><div class="text-block greeting">${textToParagraphs(text)}</div></div>`,
        ),
      },
    ];
  }

  const textPage = doc(
    book,
    `<div class="page"><div class="text-block">${textToParagraphs(text)}</div></div>`,
  );
  const illustrationPage = doc(
    book,
    `<div class="page"><img class="illustration" src="${img}"/></div>`,
  );

  switch (spread.layout) {
    case 'text-right':
      return [
        { side: 'left', html: illustrationPage },
        { side: 'right', html: textPage },
      ];
    case 'full-bleed-overlay': {
      // 2:1 spread image split across two pages; text overlaid on the left half.
      const half = (side: 'left' | 'right', overlay: boolean) =>
        doc(
          book,
          `<div class="page">
             <img class="illustration" style="width:200%; ${side === 'right' ? 'left:-100%;' : ''}" src="${img}"/>
             ${overlay ? `<div class="overlay-text">${textToParagraphs(text)}</div>` : ''}
           </div>`,
        );
      return [
        { side: 'left', html: half('left', true) },
        { side: 'right', html: half('right', false) },
      ];
    }
    case 'text-bottom':
      return [
        { side: 'left', html: textPage },
        {
          side: 'right',
          html: doc(
            book,
            `<div class="page">
               <img class="band-illustration" src="${img}"/>
               <div class="band-text">${textToParagraphs(text)}</div>
             </div>`,
          ),
        },
      ];
    case 'text-left':
    default:
      return [
        { side: 'left', html: textPage },
        { side: 'right', html: illustrationPage },
      ];
  }
}

/** Title page (first interior page): book title + byline. */
export function renderTitlePage(book: BookData): string {
  return doc(
    book,
    `<div class="page"><div class="text-block">
       <div class="display title-page-title">${escapeHtml(book.title)}</div>
     </div></div>`,
  );
}

/** Blank filler page (to pad interior to the required page count). */
export function renderBlankPage(book: BookData): string {
  return doc(book, `<div class="page"></div>`);
}

/**
 * Assemble the ordered list of interior page HTML documents:
 * title page, greeting (if any), story spreads, padded to PRINT.interiorPages.
 */
export function renderInteriorPages(book: BookData, forPrint = false): string[] {
  const pages: string[] = [renderTitlePage(book)];
  if (book.greeting) {
    const greetingSpread: SpreadData = {
      id: 'greeting',
      position: 0,
      kind: 'greeting',
      text: book.greeting,
      layout: 'text-left',
      imageUrl: null,
      printImageUrl: null,
    };
    pages.push(...renderSpreadPages(book, greetingSpread, forPrint).map((p) => p.html));
  }
  const story = [...book.spreads]
    .filter((s) => s.kind === 'story')
    .sort((a, b) => a.position - b.position);
  for (const spread of story) {
    pages.push(...renderSpreadPages(book, spread, forPrint).map((p) => p.html));
  }
  while (pages.length < PRINT.interiorPages) pages.push(renderBlankPage(book));
  return pages;
}
