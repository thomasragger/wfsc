import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATE_COLUMNS =
  "id, category_id, title, tagline, description, suggested_style_id, example_image_url, sort_order";

interface TemplateRow {
  id: string;
  category_id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  suggested_style_id: string | null;
  example_image_url: string | null;
  sort_order: number;
}

function serialize(t: TemplateRow) {
  return {
    id: t.id,
    categoryId: t.category_id,
    title: t.title,
    tagline: t.tagline,
    description: t.description,
    suggestedStyleId: t.suggested_style_id,
    exampleImageUrl: t.example_image_url,
  };
}

/** GET /api/templates — all active story templates; ?id=<slug> for a single one. */
export async function GET(request: Request) {
  try {
    const db = supabaseAdmin();
    const id = new URL(request.url).searchParams.get("id");

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
      return NextResponse.json({ template: serialize(data as TemplateRow) });
    }

    const { data, error } = await db
      .from("story_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ templates: ((data ?? []) as TemplateRow[]).map(serialize) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load templates" },
      { status: 500 },
    );
  }
}
