import type { BookData, SpreadData, FontPairingId } from '@wfsc/book-engine';
import { renderCoverPdf, renderInteriorPdf } from '@wfsc/book-engine/pdf';

import { launchBrowser } from './browser';
import { coverDimensions, spineFromCoverDimensions, type LuluCoverDimensions } from './lulu';
import {
  BOOK_ASSETS_BUCKET,
  canonicalStorageUrl,
  ensurePrivateBucket,
  signUrls,
} from './storage';
import { supabaseAdmin } from './supabase';

interface BookRow {
  id: string;
  title: string | null;
  greeting: string | null;
  greeting_from?: string | null;
  font_pairing: string;
  style_id: string;
  format: 'board' | 'softcover' | 'hardcover' | null;
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

/**
 * Build BookData with SIGNED image URLs: the headless browser rendering the
 * PDF fetches images over HTTP, and customer assets live in private buckets.
 */
export async function toBookData(book: BookRow, spreads: SpreadRow[]): Promise<BookData> {
  const [coverImageUrl, coverPrintImageUrl] = await signUrls([
    book.cover_image_url,
    book.cover_print_image_url,
  ]);
  const imageUrls = await signUrls(spreads.map((s) => s.image_url));
  const printImageUrls = await signUrls(spreads.map((s) => s.print_image_url));
  return {
    id: book.id,
    title: book.title ?? 'Our Story',
    greeting: book.greeting,
    greetingFrom: book.greeting_from ?? null,
    fontPairing: book.font_pairing as FontPairingId,
    styleId: book.style_id,
    coverImageUrl,
    coverPrintImageUrl,
    spreads: spreads.map(
      (s, i): SpreadData => ({
        id: s.id,
        position: s.position,
        kind: s.kind as SpreadData['kind'],
        text: s.text,
        layout: s.layout as SpreadData['layout'],
        imageUrl: imageUrls[i],
        printImageUrl: printImageUrls[i],
      }),
    ),
  };
}

async function uploadPdf(path: string, bytes: Uint8Array): Promise<string> {
  await ensurePrivateBucket(BOOK_ASSETS_BUCKET);
  const { error } = await supabaseAdmin()
    .storage.from(BOOK_ASSETS_BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`PDF upload failed: ${error.message}`);
  return canonicalStorageUrl(BOOK_ASSETS_BUCKET, path);
}

/**
 * Render interior + cover PDFs for a book and upload them to PRIVATE storage.
 * Returns canonical URLs (for the DB) and signed URLs (for Lulu's download).
 */
export async function renderAndUploadPdfs(
  book: BookRow,
  spreads: SpreadRow[],
): Promise<{
  interiorUrl: string;
  coverUrl: string;
  signedInteriorUrl: string;
  signedCoverUrl: string;
  coverDims: LuluCoverDimensions;
}> {
  const bookData = await toBookData(book, spreads);
  // Board books have no Lulu SKU (they're held for manual fulfillment); the
  // trim is identical to the hardcover, so use its cover geometry for the PDF.
  const format = book.format === 'board' || !book.format ? 'hardcover' : book.format;
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
      uploadPdf(`books/${book.id}/print-pdfs/interior-${stamp}.pdf`, interior),
      uploadPdf(`books/${book.id}/print-pdfs/cover-${stamp}.pdf`, cover),
    ]);
    const [signedInteriorUrl, signedCoverUrl] = await signUrls([interiorUrl, coverUrl]);
    return {
      interiorUrl,
      coverUrl,
      signedInteriorUrl: signedInteriorUrl!,
      signedCoverUrl: signedCoverUrl!,
      coverDims: dims,
    };
  } finally {
    await browser.close();
  }
}
