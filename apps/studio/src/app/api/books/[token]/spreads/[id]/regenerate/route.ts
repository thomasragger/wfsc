import { NextResponse } from "next/server";
import { z } from "zod";

import { inngest } from "@/inngest/client";
import { fetchBookBundle } from "@/lib/books";
import { regenCountForBook } from "@/lib/generation-jobs";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string; id: string }> };

const RegenerateSchema = z.object({
  note: z.string().trim().min(3, "Tell us what to change").max(600),
});

/**
 * POST /api/books/[token]/spreads/[id]/regenerate — store the customer's
 * adjustment note and queue an illustration regeneration.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { token, id } = await params;
    const parsed = RegenerateSchema.safeParse(await request.json());
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
    if (bundle.book.status !== "ready_for_review") {
      return NextResponse.json(
        { error: "Illustrations can only be redrawn while reviewing your book" },
        { status: 409 },
      );
    }

    const spread = bundle.payload.spreads.find((s) => s.id === id);
    if (!spread) {
      return NextResponse.json({ error: "Spread not found" }, { status: 404 });
    }

    // Regenerations cost real money; cap the edit loop per book.
    const maxRegens = Number(process.env.WFSC_MAX_REGENS_PER_BOOK ?? 15);
    if (maxRegens > 0 && (await regenCountForBook(bundle.book.id)) >= maxRegens) {
      return NextResponse.json(
        {
          error:
            "You've reached the redraw limit for this book. Reply to any of our emails and we'll happily help with further tweaks.",
        },
        { status: 429 },
      );
    }

    const db = supabaseAdmin();
    const { error } = await db
      .from("book_spreads")
      .update({ regen_note: parsed.data.note })
      .eq("id", spread.id)
      .eq("book_id", bundle.book.id);
    if (error) throw new Error(error.message);

    await inngest.send({
      name: "book/spread.regenerate",
      data: { bookId: bundle.book.id, spreadId: spread.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to queue regeneration" },
      { status: 500 },
    );
  }
}
