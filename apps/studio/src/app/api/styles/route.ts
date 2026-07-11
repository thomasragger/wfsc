import { NextResponse } from "next/server";

import { resolveLocale } from "@/i18n/request";
import { localizeRow } from "@/lib/i18n-content";
import { signUrls } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many real sample books to attach per style. */
const SAMPLE_BOOKS_PER_STYLE = 2;

interface SampleBookRef {
  token: string;
  title: string | null;
  coverUrl: string | null;
}

/**
 * Up to 2 REAL sample books per style (books.is_sample): public token, title
 * and cover thumbnail, kept deliberately light — the wizard fetches the full
 * book payload lazily when the reader overlay opens. Degrades to empty lists
 * on any error (missing column, no samples yet).
 */
async function sampleBooksByStyle(
  styleIds: string[],
  locale: string,
): Promise<Map<string, SampleBookRef[]>> {
  const byStyle = new Map<string, SampleBookRef[]>();
  if (styleIds.length === 0) return byStyle;
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("books")
      .select("access_token, title, cover_image_url, style_id, translations, created_at")
      .eq("is_sample", true)
      .in("style_id", styleIds)
      .order("created_at", { ascending: true });
    if (error || !data?.length) return byStyle;

    // Localize titles / cover variants the same way the samples gallery does.
    const rows = data.map((raw) => {
      const localized = localizeRow(raw as Record<string, unknown>, locale) as {
        access_token: string;
        title: string | null;
        cover_image_url: string | null;
        style_id: string;
      };
      return localized;
    });

    const picked: { styleId: string; row: (typeof rows)[number] }[] = [];
    for (const row of rows) {
      const count = picked.filter((p) => p.styleId === row.style_id).length;
      if (count >= SAMPLE_BOOKS_PER_STYLE) continue;
      picked.push({ styleId: row.style_id, row });
    }

    // Sample covers normally live in the public renders bucket (signUrls
    // passes those through); pipeline-generated covers in private buckets
    // get signed so the wizard never renders a 403 image.
    const covers = await signUrls(picked.map((p) => p.row.cover_image_url));
    picked.forEach((p, i) => {
      const list = byStyle.get(p.styleId) ?? [];
      list.push({
        token: p.row.access_token,
        title: p.row.title ?? null,
        coverUrl: covers[i] ?? null,
      });
      byStyle.set(p.styleId, list);
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
    const samples = await sampleBooksByStyle(
      rows.map((s) => s.id as string),
      locale,
    );

    return NextResponse.json({
      styles: rows.map((s) => ({
        id: s.id as string,
        name: s.name as string,
        description: (s.description ?? null) as string | null,
        previewImageUrl: (s.preview_image_url ?? null) as string | null,
        referenceImageUrls: (s.reference_image_urls ?? []) as string[],
        sampleBooks: samples.get(s.id as string) ?? [],
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load styles" },
      { status: 500 },
    );
  }
}
