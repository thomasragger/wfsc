import { fetchBookBundle, type BookBundle } from "@/lib/books";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Sample books: real books flagged `books.is_sample = true`, shown as a
 * public gallery. The column ships from a parallel workstream, so every
 * query here degrades gracefully (returns empty / null) if it's missing.
 */

export interface SampleSummary {
  token: string;
  title: string | null;
  coverImageUrl: string | null;
  /** Photorealistic product-shot render of the cover, if generated — prefer
   *  this over coverImageUrl anywhere a book is shown as a physical object. */
  mockupImageUrl: string | null;
  templateId: string | null;
  categoryId: string | null;
  categoryName: string | null;
}

interface SampleRow {
  access_token: string;
  title: string | null;
  cover_image_url: string | null;
  mockup_image_url: string | null;
  template_id: string | null;
}

export async function fetchSamples(): Promise<SampleSummary[]> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("books")
      .select("access_token, title, cover_image_url, mockup_image_url, template_id")
      .eq("is_sample", true)
      .order("created_at", { ascending: true });
    if (error) return [];
    const rows = (data ?? []) as SampleRow[];
    if (rows.length === 0) return [];

    // Resolve template -> category -> category name (best effort).
    const templateToCategory = new Map<string, string>();
    const categoryNames = new Map<string, string>();
    const templateIds = [...new Set(rows.map((r) => r.template_id).filter((v): v is string => !!v))];
    if (templateIds.length > 0) {
      const { data: tpls } = await db
        .from("story_templates")
        .select("id, category_id")
        .in("id", templateIds);
      for (const t of (tpls ?? []) as { id: string; category_id: string }[]) {
        templateToCategory.set(t.id, t.category_id);
      }
      const categoryIds = [...new Set(templateToCategory.values())];
      if (categoryIds.length > 0) {
        const { data: cats } = await db
          .from("template_categories")
          .select("id, name")
          .in("id", categoryIds);
        for (const c of (cats ?? []) as { id: string; name: string }[]) {
          categoryNames.set(c.id, c.name);
        }
      }
    }

    return rows.map((r) => {
      const categoryId = r.template_id ? (templateToCategory.get(r.template_id) ?? null) : null;
      return {
        token: r.access_token,
        title: r.title,
        coverImageUrl: r.cover_image_url,
        mockupImageUrl: r.mockup_image_url,
        templateId: r.template_id,
        categoryId,
        categoryName: categoryId ? (categoryNames.get(categoryId) ?? null) : null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Load a sample book's full bundle for the read-only viewer.
 * Returns null unless the book exists AND is flagged as a sample.
 */
export async function fetchSampleBundle(token: string): Promise<BookBundle | null> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("books")
      .select("id, is_sample")
      .eq("access_token", token)
      .maybeSingle();
    if (error || !data || !(data as { is_sample?: boolean }).is_sample) return null;
    return await fetchBookBundle(token);
  } catch {
    return null;
  }
}
