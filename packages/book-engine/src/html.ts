import { FONT_PAIRINGS, SCRIPT_FONT, fontStylesheetUrl } from './fonts';
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
    .greeting {
      font-family: '${SCRIPT_FONT.family}', cursive;
      font-weight: ${SCRIPT_FONT.weight};
      font-size: 30pt; line-height: 1.7; color: #4a3f39;
      transform: rotate(-4deg);
    }
    .greeting-from {
      margin-top: 18pt; font-size: 26pt; color: #6b5f57;
    }
    .inset-illustration-page {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .inset-illustration-page img {
      width: 78%; aspect-ratio: 1; object-fit: cover; border-radius: 6px;
    }
    .byline { font-size: 12pt; color: #6b5d55; }
    .byline-logo { width: 1.5in; height: auto; margin-top: 0.12in; }
    .subtitle { font-size: 14pt; color: #4a3f39; margin-top: 0.3in; }
    .title-page-title { font-size: 42pt; line-height: 1.2; }
    .title-illustration { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .title-scrim {
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(255,253,248,0.88) 0%, rgba(255,253,248,0.55) 34%, rgba(255,253,248,0) 62%);
    }
    .title-block {
      position: absolute; left: ${PRINT.bleedIn + PRINT.safeMarginIn}in; right: ${PRINT.bleedIn + PRINT.safeMarginIn}in;
      top: ${PRINT.bleedIn + PRINT.safeMarginIn}in; height: 30%;
      display: flex; align-items: center; justify-content: center; text-align: center;
    }
    .logo-page {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.35in; height: 100%;
    }
    .logo-page img { width: 2.4in; height: auto; }
    .logo-page .tagline { font-size: 11pt; color: #8a7c73; }
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
  // Story illustrations sit inset on the cream page (like the brand's example
  // books) rather than full-bleed; 'full-bleed-overlay' remains the big-moment
  // full-bleed treatment.
  const illustrationPage = doc(
    book,
    `<div class="page"><div class="inset-illustration-page"><img src="${img}"/></div></div>`,
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

/** Default logo used on the closing page (overridable via book.logoUrl). */
export const DEFAULT_LOGO_URL = 'https://wfsc-studio.vercel.app/logo.png';

/**
 * Illustrated title page (first interior page): the cover illustration under a
 * soft cream scrim, with the title set large in the display font.
 */
export function renderTitlePage(book: BookData, forPrint = false): string {
  const img = escapeHtml((forPrint ? book.coverPrintImageUrl : book.coverImageUrl) ?? '');
  if (!img) {
    return doc(
      book,
      `<div class="page"><div class="text-block">
         <div class="display title-page-title">${escapeHtml(book.title)}</div>
       </div></div>`,
    );
  }
  return doc(
    book,
    `<div class="page">
       <img class="title-illustration" src="${img}"/>
       <div class="title-scrim"></div>
       <div class="title-block">
         <div class="display title-page-title">${escapeHtml(book.title)}</div>
       </div>
     </div>`,
  );
}

/** Personalized dedication (Widmung): script font, gently tilted. */
export function renderDedicationPage(book: BookData): string {
  if (!book.greeting) return doc(book, `<div class="page"></div>`);
  const from = book.greetingFrom?.trim()
    ? `<p class="greeting-from">Love, ${escapeHtml(book.greetingFrom.trim())}</p>`
    : '';
  return doc(
    book,
    `<div class="page"><div class="text-block greeting">${textToParagraphs(book.greeting)}${from}</div></div>`,
  );
}

/**
 * Typographic title page (faces the dedication, like the brand's example
 * books): title, "A special story with …" subtitle, and the logo byline.
 */
export function renderTypographicTitlePage(book: BookData): string {
  const logo = escapeHtml(book.logoUrl ?? DEFAULT_LOGO_URL);
  const names = (book.peopleNames ?? []).map(escapeHtml);
  const withLine =
    names.length > 0
      ? `<div class="subtitle">A special story with<br/>${names.join(' and ')}</div>`
      : '';
  return doc(
    book,
    `<div class="page"><div class="text-block">
       <div class="display title-page-title">${escapeHtml(book.title)}</div>
       ${withLine}
       <div class="byline" style="margin-top: 0.9in;">Text &amp; Illustrations by</div>
       <img class="byline-logo" src="${logo}" alt="Warm Fuzzy Story Club"/>
     </div></div>`,
  );
}

/** Closing page: the WFSC logo, centered. Always the last interior page. */
export function renderLogoPage(book: BookData): string {
  const logo = escapeHtml(book.logoUrl ?? DEFAULT_LOGO_URL);
  return doc(
    book,
    `<div class="page"><div class="logo-page">
       <img src="${logo}" alt="Warm Fuzzy Story Club"/>
       <div class="tagline">Made with love &middot; warmfuzzystoryclub.com</div>
     </div></div>`,
  );
}

/** Blank filler page (to pad interior to the required page count). */
export function renderBlankPage(book: BookData): string {
  return doc(book, `<div class="page"></div>`);
}

/**
 * Assemble the ordered list of interior page HTML documents, mirroring the
 * brand's example books:
 *   p1 (recto):  illustrated half-title (cover art + display title)
 *   p2 (verso):  personalized dedication, script font, tilted
 *   p3 (recto):  typographic title page (subtitle + logo byline)
 *   p4…:         story spreads (verso+recto pairs)
 *   …blanks…
 *   last (verso): logo closing page ("Made with love")
 * Total = PRINT.interiorPages.
 */
export function renderInteriorPages(book: BookData, forPrint = false): string[] {
  const pages: string[] = [
    renderTitlePage(book, forPrint),
    renderDedicationPage(book),
    renderTypographicTitlePage(book),
  ];
  const story = [...book.spreads]
    .filter((s) => s.kind === 'story')
    .sort((a, b) => a.position - b.position);
  for (const spread of story) {
    pages.push(...renderSpreadPages(book, spread, forPrint).map((p) => p.html));
  }
  while (pages.length < PRINT.interiorPages - 1) pages.push(renderBlankPage(book));
  pages.push(renderLogoPage(book));
  return pages;
}
