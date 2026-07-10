import { resolveLocale } from "@/i18n/request";
import { localizeRow } from "@/lib/i18n-content";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Category taxonomy loaders for the marketing site nav and category pages.
 * Two independent axes, both Supabase-native:
 *  - audience categories (`template_categories`): mums, dads, grandparents, …
 *  - occasion categories (`occasion_categories`): birthday, new-baby, …
 * Story templates link to an audience category (FK) and tag occasions (array).
 */

export interface AudienceCategory {
  id: string;
  name: string;
  tagline: string | null;
  heroImageUrl: string | null;
}

export interface OccasionCategory {
  id: string;
  name: string;
  tagline: string | null;
}

export interface CategoryTemplate {
  id: string;
  categoryId: string;
  title: string;
  tagline: string | null;
  previewImageUrl: string | null;
  mockupImageUrl: string | null;
  exampleImageUrl: string | null;
  region: string | null;
}

const TPL_COLS = "id, category_id, title, tagline, preview_image_url, mockup_image_url, example_image_url, region, sort_order, translations";

function tpl(row: Record<string, unknown>): CategoryTemplate {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    title: row.title as string,
    tagline: (row.tagline ?? null) as string | null,
    previewImageUrl: (row.preview_image_url ?? null) as string | null,
    mockupImageUrl: (row.mockup_image_url ?? null) as string | null,
    exampleImageUrl: (row.example_image_url ?? null) as string | null,
    region: (row.region ?? null) as string | null,
  };
}

export async function loadAudienceCategories(): Promise<AudienceCategory[]> {
  try {
    const locale = await resolveLocale();
    const { data } = await supabaseAdmin()
      .from("template_categories")
      .select("id, name, tagline, hero_image_url, sort_order, translations")
      .neq("id", "places") // locations are their own nav axis, not an audience
      .order("sort_order", { ascending: true });
    return (data ?? []).map((row) => localizeRow(row, locale)).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      tagline: (c.tagline ?? null) as string | null,
      heroImageUrl: (c.hero_image_url ?? null) as string | null,
    }));
  } catch {
    return [];
  }
}

export async function loadOccasionCategories(): Promise<OccasionCategory[]> {
  try {
    const locale = await resolveLocale();
    const { data } = await supabaseAdmin()
      .from("occasion_categories")
      .select("id, name, tagline, sort_order, translations")
      .order("sort_order", { ascending: true });
    return (data ?? []).map((row) => localizeRow(row, locale)).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      tagline: (c.tagline ?? null) as string | null,
    }));
  } catch {
    return [];
  }
}

/** Nav needs both axes at once. */
export async function loadNavCategories(): Promise<{
  audience: AudienceCategory[];
  occasions: OccasionCategory[];
}> {
  const [audience, occasions] = await Promise.all([
    loadAudienceCategories(),
    loadOccasionCategories(),
  ]);
  return { audience, occasions };
}

export async function loadAudiencePage(
  id: string,
  region?: string | null,
): Promise<{ category: AudienceCategory; templates: CategoryTemplate[] } | null> {
  try {
    const db = supabaseAdmin();
    const locale = await resolveLocale();
    const [catRes, tplRes] = await Promise.all([
      db.from("template_categories").select("id, name, tagline, hero_image_url, translations").eq("id", id).maybeSingle(),
      db.from("story_templates").select(TPL_COLS).eq("category_id", id).eq("is_active", true).order("sort_order", { ascending: true }),
    ]);
    if (!catRes.data) return null;
    const c = localizeRow(catRes.data, locale);
    // Region-tagged templates (locations) only show for their region; untagged
    // templates show everywhere.
    let templates = (tplRes.data ?? []).map((row) => tpl(localizeRow(row, locale)));
    if (region) templates = templates.filter((t) => !t.region || t.region === region);
    return {
      category: {
        id: c.id as string,
        name: c.name as string,
        tagline: (c.tagline ?? null) as string | null,
        heroImageUrl: (c.hero_image_url ?? null) as string | null,
      },
      templates,
    };
  } catch {
    return null;
  }
}

export async function loadOccasionPage(
  id: string,
): Promise<{ occasion: OccasionCategory; templates: CategoryTemplate[] } | null> {
  try {
    const db = supabaseAdmin();
    const locale = await resolveLocale();
    const [occRes, tplRes] = await Promise.all([
      db.from("occasion_categories").select("id, name, tagline, translations").eq("id", id).maybeSingle(),
      db.from("story_templates").select(TPL_COLS).eq("is_active", true).contains("occasions", [id]).order("sort_order", { ascending: true }),
    ]);
    if (!occRes.data) return null;
    const o = localizeRow(occRes.data, locale);
    return {
      occasion: { id: o.id as string, name: o.name as string, tagline: (o.tagline ?? null) as string | null },
      templates: (tplRes.data ?? []).map((row) => tpl(localizeRow(row, locale))),
    };
  } catch {
    return null;
  }
}

/** All active templates, for the /books browse-all page. */
export async function loadAllTemplates(): Promise<CategoryTemplate[]> {
  try {
    const locale = await resolveLocale();
    const { data } = await supabaseAdmin()
      .from("story_templates")
      .select(TPL_COLS)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return (data ?? []).map((row) => tpl(localizeRow(row, locale)));
  } catch {
    return [];
  }
}
