import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/styles — active illustration styles for the intake wizard. */
export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("styles")
      .select("id, name, description, preview_image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    return NextResponse.json({
      styles: (data ?? []).map((s) => ({
        id: s.id as string,
        name: s.name as string,
        description: (s.description ?? null) as string | null,
        previewImageUrl: (s.preview_image_url ?? null) as string | null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load styles" },
      { status: 500 },
    );
  }
}
