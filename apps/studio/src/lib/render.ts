import type { BookData, SpreadData, FontPairingId } from '@wfsc/book-engine';
import { renderCoverPdf, renderInteriorPdf } from '@wfsc/book-engine/pdf';

import { launchBrowser } from './browser';
import { coverDimensions, spineFromCoverDimensions, type LuluCoverDimensions } from './lulu';
import { supabaseAdmin } from './supabase';

const PRINT_BUCKET = 'print';

interface BookRow {
  id: string;
  title: string | null;
  greeting: string | null;
  font_pairing: string;
  style_id: string;
  format: 'softcover' | 'hardcover' | null;
  page_count: number;
  cover_image_url: string | null;
  cover_print_image_url: string | null;
}

interface SpreadRow {
  id: string;
  position: number;
  kind: string;
  text: string | null;
  layout: string;
  image_url: string | null;
  print_image_url: string | null;
}

export function toBookData(book: BookRow, spreads: SpreadRow[]): BookData {
  return {
    id: book.id,
    title: book.title ?? 'Our Story',
    greeting: book.greeting,
    fontPairing: book.font_pairing as FontPairingId,
    styleId: book.style_id,
    coverImageUrl: book.cover_image_url,
    coverPrintImageUrl: book.cover_print_image_url,
    spreads: spreads.map(
      (s): SpreadData => ({
        id: s.id,
        position: s.position,
        kind: s.kind as SpreadData['kind'],
        text: s.text,
        layout: s.layout as SpreadData['layout'],
        imageUrl: s.image_url,
        printImageUrl: s.print_image_url,
      }),
    ),
  };
}

async function uploadPdf(path: string, bytes: Uint8Array): Promise<string> {
  const db = supabaseAdmin();
  await db.storage.createBucket(PRINT_BUCKET, { public: true }).catch(() => undefined);
  const { error } = await db.storage
    .from(PRINT_BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`PDF upload failed: ${error.message}`);
  const { data } = db.storage.from(PRINT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Render interior + cover PDFs for a book and upload them to public storage
 * (Lulu downloads them via source_url). Returns the public URLs.
 */
export async function renderAndUploadPdfs(
  book: BookRow,
  spreads: SpreadRow[],
): Promise<{ interiorUrl: string; coverUrl: string; coverDims: LuluCoverDimensions }> {
  const bookData = toBookData(book, spreads);
  const format = book.format ?? 'hardcover';
  const dims = await coverDimensions(format, book.page_count);

  const browser = await launchBrowser();
  try {
    const interior = await renderInteriorPdf(browser, bookData);
    const cover = await renderCoverPdf(browser, bookData, {
      widthPt: Number(dims.width),
      heightPt: Number(dims.height),
      spineWidthPt: spineFromCoverDimensions(dims),
    });
    const stamp = Date.now();
    const [interiorUrl, coverUrl] = await Promise.all([
      uploadPdf(`${book.id}/interior-${stamp}.pdf`, interior),
      uploadPdf(`${book.id}/cover-${stamp}.pdf`, cover),
    ]);
    return { interiorUrl, coverUrl, coverDims: dims };
  } finally {
    await browser.close();
  }
}
