import { NextResponse } from "next/server";

import { resolveLocale } from "@/i18n/request";
import { localizeRow } from "@/lib/i18n-content";
import { signUrls } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many real sample spreads to attach per style. */
const SAMPLE_SPREADS_PER_STYLE = 2;

/**
 * Up to 2 REAL rendered spread images per style, pulled from sample books
 * (books.is_sample) in that style. Lets the wizard show honest "pages from
 * real books in this style" next to the picker. Degrades to empty lists on
 * any error (missing column, no samples yet).
 */
async function sampleSpreadsByStyle(styleIds: string[]): Promise<Map<string, string[]>> {
  const byStyle = new Map<string, string[]>();
  if (styleIds.length === 0) return byStyle;
  try {
    const db = supabaseAdmin();
    const { data: sampleBooks, error: booksError } = await db
      .from("books")
      .select("id, style_id")
      .eq("is_sample", true)
      .in("style_id", styleIds);
    if (booksError || !sampleBooks?.length) return byStyle;

    const styleByBook = new Map(sampleBooks.map((b) => [b.id as string, b.style_id as string]));
    const { data: spreads, error: spreadsError } = await db
      .from("book_spreads")
      .select("book_id, image_url, position")
      .in("book_id", [...styleByBook.keys()])
      .eq("kind", "story")
      .not("image_url", "is", null)
      .order("position", { ascending: true });
    if (spreadsError || !spreads?.length) return byStyle;

    for (const s of spreads) {
      const styleId = styleByBook.get(s.book_id as string);
      if (!styleId || !s.image_url) continue;
      const urls = byStyle.get(styleId) ?? [];
      if (urls.length >= SAMPLE_SPREADS_PER_STYLE) continue;
      urls.push(s.image_url as string);
      byStyle.set(styleId, urls);
    }

    // Sample spreads normally live in the public renders bucket (signUrls
    // passes those through); anything in a private bucket gets signed so the
    // wizard never renders a 403 image.
    const flat = [...byStyle.entries()].flatMap(([styleId, urls]) =>
      urls.map((url) => ({ styleId, url })),
    );
    const signed = await signUrls(flat.map((f) => f.url));
    byStyle.clear();
    flat.forEach((f, i) => {
      const url = signed[i];
      if (!url) return;
      byStyle.set(f.styleId, [...(byStyle.get(f.styleId) ?? []), url]);
    });
    return byStyle;
  } catch {
    return byStyle; // never let sample decoration break the style list
  }
}

/** GET /api/styles — active illustration styles for the intake wizard. */
export async function GET() {
  try {
    const db = supabaseAdmin();
    const locale = await resolveLocale();
    const { data, error } = await db
      .from("styles")
      .select("id, name, description, preview_image_url, reference_image_urls, sort_order, translations")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((row) => localizeRow(row, locale));
    const samples = await sampleSpreadsByStyle(rows.map((s) => s.id as string));

    return NextResponse.json({
      styles: rows.map((s) => ({
        id: s.id as string,
        name: s.name as string,
        description: (s.description ?? null) as string | null,
        previewImageUrl: (s.preview_image_url ?? null) as string | null,
        referenceImageUrls: (s.reference_image_urls ?? []) as string[],
        sampleSpreadUrls: samples.get(s.id as string) ?? [],
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load styles" },
      { status: 500 },
    );
  }
}
