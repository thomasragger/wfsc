import { NextResponse } from "next/server";

import { resolveLocale } from "@/i18n/request";
import { localizeRow } from "@/lib/i18n-content";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATE_COLUMNS =
  "id, category_id, title, tagline, description, suggested_style_id, story_beats, cover_concept, prompt_scaffold, example_image_url, preview_image_url, mockup_image_url, age_min, age_max, occasions, sort_order, translations";

interface TemplateRow {
  preview_image_url?: string | null;
  mockup_image_url?: string | null;
  cover_concept?: string | null;
  prompt_scaffold?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  occasions?: string[] | null;
  id: string;
  category_id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  suggested_style_id: string | null;
  story_beats: unknown;
  example_image_url: string | null;
  sort_order: number;
}

interface CategoryRow {
  id: string;
  name: string;
  tagline: string | null;
}

function beats(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is string => typeof b === "string");
}

function serialize(t: TemplateRow) {
  return {
    id: t.id,
    categoryId: t.category_id,
    title: t.title,
    tagline: t.tagline,
    description: t.description,
    suggestedStyleId: t.suggested_style_id,
    storyBeats: beats(t.story_beats),
    coverConcept: t.cover_concept ?? null,
    promptScaffold: t.prompt_scaffold ?? null,
    exampleImageUrl: t.example_image_url,
    previewImageUrl: t.preview_image_url ?? null,
    mockupImageUrl: t.mockup_image_url ?? null,
    ageMin: t.age_min ?? null,
    ageMax: t.age_max ?? null,
    occasions: t.occasions ?? [],
  };
}

async function loadCategory(id: string, locale: string): Promise<CategoryRow | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("template_categories")
    .select("id, name, tagline, translations")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return localizeRow(data, locale) as CategoryRow;
}

/**
 * GET /api/templates — all active story templates.
 *   ?id=<slug>        a single template (includes its category)
 *   ?category=<slug>  templates of one category, plus the category itself
 */
export async function GET(request: Request) {
  try {
    const db = supabaseAdmin();
    const locale = await resolveLocale();
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const category = params.get("category");

    // Display fields (title/tagline/description) localize; story_beats and
    // prompt_scaffold stay English on purpose — they feed the story writer,
    // which writes in the book's locale regardless.
    const localize = (t: TemplateRow) =>
      localizeRow(t as unknown as Record<string, unknown>, locale) as unknown as TemplateRow;

    if (id) {
      const { data, error } = await db
        .from("story_templates")
        .select(TEMPLATE_COLUMNS)
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      const template = localize(data as TemplateRow);
      const cat = await loadCategory(template.category_id, locale);
      return NextResponse.json({
        template: { ...serialize(template), categoryName: cat?.name ?? null },
      });
    }

    if (category) {
      const [cat, tplRes] = await Promise.all([
        loadCategory(category, locale),
        db
          .from("story_templates")
          .select(TEMPLATE_COLUMNS)
          .eq("category_id", category)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);
      if (tplRes.error) throw new Error(tplRes.error.message);
      if (!cat) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      return NextResponse.json({
        category: cat,
        templates: ((tplRes.data ?? []) as TemplateRow[]).map(localize).map((t) => ({
          ...serialize(t),
          categoryName: cat.name,
        })),
      });
    }

    const { data, error } = await db
      .from("story_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({
      templates: ((data ?? []) as TemplateRow[]).map(localize).map(serialize),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load templates" },
      { status: 500 },
    );
  }
}
