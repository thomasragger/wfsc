/**
 * Render print-ready interior + cover PDFs for every sample book and store the
 * public URLs on books.pdf_interior_url / pdf_cover_url. Uses the same
 * renderAndUploadPdfs the order pipeline uses, so what you inspect is exactly
 * what a real order would print.
 *
 * Run (from repo root): set -a; . ./.env; set +a; npx tsx apps/studio/scripts/render-sample-pdfs.mts
 */
import { renderAndUploadPdfs } from "../src/lib/render";
import { supabaseAdmin } from "../src/lib/supabase";

const db = supabaseAdmin();
const { data: samples, error } = await db
  .from("books")
  .select(
    "id, title, greeting, greeting_from, font_pairing, style_id, format, page_count, cover_image_url, cover_print_image_url",
  )
  .eq("is_sample", true)
  .order("created_at");
if (error) throw error;
console.log(`▸ rendering PDFs for ${samples?.length ?? 0} samples…`);

for (const book of samples ?? []) {
  try {
    const { data: spreads } = await db
      .from("book_spreads")
      .select("id, position, kind, text, layout, image_url, print_image_url")
      .eq("book_id", book.id)
      .order("position");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await renderAndUploadPdfs(book as any, (spreads ?? []) as any);
    await db
      .from("books")
      .update({ pdf_interior_url: res.interiorUrl, pdf_cover_url: res.coverUrl })
      .eq("id", book.id);
    console.log(`  ✓ ${book.title}`);
    console.log(`     interior: ${res.interiorUrl}`);
    console.log(`     cover:    ${res.coverUrl}`);
  } catch (err) {
    console.log(`  ✗ ${book.title}: ${String(err).slice(0, 200)}`);
  }
}
console.log("Done rendering sample PDFs.");
