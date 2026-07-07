import { PDFDocument } from 'pdf-lib';
import { renderInteriorPages } from '../html';
import { PRINT } from '../print';
import type { BookData } from '../types';

/**
 * PDF rendering via headless Chromium. The caller supplies a Puppeteer-compatible
 * browser instance so this package stays host-agnostic:
 *  - Studio (Vercel): puppeteer-core + @sparticuz/chromium
 *  - CLI harness: puppeteer-core + locally installed Chrome
 */
export interface BrowserLike {
  newPage(): Promise<PageLike>;
}
export interface PageLike {
  setContent(html: string): Promise<unknown>;
  evaluate(fn: () => unknown): Promise<unknown>;
  pdf(opts: {
    width: string;
    height: string;
    printBackground: boolean;
    pageRanges?: string;
  }): Promise<Uint8Array>;
  close(): Promise<void>;
}

/** Runs inside the browser: wait for webfonts and all images before printing. */
const waitForAssets = async (): Promise<void> => {
  const doc = (
    globalThis as unknown as {
      document: {
        fonts: { ready: Promise<unknown> };
        images: ArrayLike<{ complete: boolean; decode(): Promise<unknown> }>;
      };
    }
  ).document;
  await doc.fonts.ready;
  await Promise.all(
    Array.from(doc.images).map((img) => (img.complete ? undefined : img.decode().catch(() => undefined))),
  );
};

async function renderHtmlToPdfPage(browser: BrowserLike, html: string): Promise<Uint8Array> {
  const page = await browser.newPage();
  try {
    await page.setContent(html);
    await page.evaluate(waitForAssets);
    return await page.pdf({
      width: `${PRINT.pageIn}in`,
      height: `${PRINT.pageIn}in`,
      printBackground: true,
      pageRanges: '1',
    });
  } finally {
    await page.close();
  }
}

/** Render the full interior as a single print-ready PDF (returns bytes). */
export async function renderInteriorPdf(browser: BrowserLike, book: BookData): Promise<Uint8Array> {
  const pages = renderInteriorPages(book, true);
  const merged = await PDFDocument.create();
  for (const html of pages) {
    const pageBytes = await renderHtmlToPdfPage(browser, html);
    const src = await PDFDocument.load(pageBytes);
    const [copied] = await merged.copyPages(src, [0]);
    merged.addPage(copied);
  }
  return merged.save();
}

export interface CoverDimensions {
  /** Full wraparound cover width incl. bleed + wrap, in points (from Lulu /cover-dimensions/). */
  widthPt: number;
  heightPt: number;
  spineWidthPt: number;
}

/**
 * Render the one-piece wraparound cover (back | spine | front).
 * Dimensions come from Lulu's cover-dimensions API for the exact SKU + page count.
 */
export async function renderCoverPdf(
  browser: BrowserLike,
  book: BookData,
  dims: CoverDimensions,
): Promise<Uint8Array> {
  const wIn = dims.widthPt / 72;
  const hIn = dims.heightPt / 72;
  const spineIn = dims.spineWidthPt / 72;
  const panelIn = (wIn - spineIn) / 2;
  const img = book.coverPrintImageUrl ?? book.coverImageUrl ?? '';

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700&display=swap"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size: ${wIn}in ${hIn}in; margin: 0; }
    body { width:${wIn}in; height:${hIn}in; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .cover { position:relative; width:100%; height:100%; background:#f6b73c; }
    .front { position:absolute; right:0; top:0; width:${panelIn}in; height:100%; overflow:hidden; }
    .front img { width:100%; height:100%; object-fit:cover; }
    .spine { position:absolute; left:${panelIn}in; top:0; width:${spineIn}in; height:100%; background:#e8622c; }
    .back { position:absolute; left:0; top:0; width:${panelIn}in; height:100%;
            display:flex; align-items:center; justify-content:center;
            font-family:'Baloo 2'; color:#fffdf8; font-size:14pt; text-align:center; }
  </style></head><body>
    <div class="cover">
      <div class="back">Made with love<br/>· Warm Fuzzy Story Club ·</div>
      <div class="spine"></div>
      <div class="front"><img src="${img}"/></div>
    </div>
  </body></html>`;

  const page = await browser.newPage();
  try {
    await page.setContent(html);
    await page.evaluate(waitForAssets);
    return await page.pdf({
      width: `${wIn}in`,
      height: `${hIn}in`,
      printBackground: true,
      pageRanges: '1',
    });
  } finally {
    await page.close();
  }
}
