import { NextResponse } from "next/server";

import { inngest } from "@/inngest/client";
import { fetchBookBundle } from "@/lib/books";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/books/[token]/retry — re-kick the preview pipeline for a book
 * that failed or got stuck generating. Resets it to preview_generating and
 * re-sends the Inngest event.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { token } = await params;

    const bundle = await fetchBookBundle(token);
    if (!bundle) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    const retryable = ["preview_generating", "preview_failed"];
    if (!retryable.includes(bundle.book.status)) {
      return NextResponse.json(
        { error: "This book isn't in a retryable state" },
        { status: 409 },
      );
    }

    const db = supabaseAdmin();
    const { error } = await db
      .from("books")
      .update({ status: "preview_generating" })
      .eq("id", bundle.book.id);
    if (error) throw new Error(error.message);

    await inngest.send({ name: "book/preview.requested", data: { bookId: bundle.book.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Retry failed" },
      { status: 500 },
    );
  }
}
