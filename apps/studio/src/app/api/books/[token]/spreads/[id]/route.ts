import { NextResponse } from "next/server";
import { z } from "zod";

import { LAYOUTS, type LayoutId } from "@wfsc/book-engine";

import { EDITABLE_SPREAD_STATUSES } from "@/lib/book-payload";
import { fetchBookBundle } from "@/lib/books";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string; id: string }> };

const layoutIds = Object.keys(LAYOUTS) as [LayoutId, ...LayoutId[]];

const PatchSpreadSchema = z
  .object({
    text: z.string().trim().max(1200).optional(),
    layout: z.enum(layoutIds).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

/** PATCH /api/books/[token]/spreads/[id] — edit spread text or layout. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { token, id } = await params;
    const parsed = PatchSpreadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const bundle = await fetchBookBundle(token);
    if (!bundle) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    if (!EDITABLE_SPREAD_STATUSES.includes(bundle.book.status)) {
      return NextResponse.json(
        { error: "This book can no longer be edited" },
        { status: 409 },
      );
    }

    const spread = bundle.payload.spreads.find((s) => s.id === id);
    if (!spread) {
      return NextResponse.json({ error: "Spread not found" }, { status: 404 });
    }

    // Full-spread illustrations use a 2:1 image; single-page layouts are square.
    // Switching into full-bleed-overlay would need a regenerated illustration.
    if (
      parsed.data.layout === "full-bleed-overlay" &&
      spread.layout !== "full-bleed-overlay"
    ) {
      return NextResponse.json(
        { error: "This page's illustration doesn't fit the full-spread layout" },
        { status: 400 },
      );
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.text !== undefined) update.text = parsed.data.text;
    if (parsed.data.layout !== undefined) update.layout = parsed.data.layout;

    const db = supabaseAdmin();
    const { error } = await db
      .from("book_spreads")
      .update(update)
      .eq("id", spread.id)
      .eq("book_id", bundle.book.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update page" },
      { status: 500 },
    );
  }
}
