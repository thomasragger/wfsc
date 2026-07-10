import { NextResponse } from "next/server";

import { inngest } from "@/inngest/client";
import { captureServer } from "@/lib/analytics";
import { fetchBookBundle } from "@/lib/books";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

/** POST /api/books/[token]/approve — customer signs off; book goes to print prep. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { token } = await params;

    const bundle = await fetchBookBundle(token);
    if (!bundle) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    if (bundle.book.status !== "ready_for_review") {
      return NextResponse.json(
        { error: "This book isn't awaiting approval" },
        { status: 409 },
      );
    }

    const db = supabaseAdmin();
    const { error } = await db
      .from("books")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", bundle.book.id)
      .eq("status", "ready_for_review");
    if (error) throw new Error(error.message);

    await inngest.send({ name: "book/approved", data: { bookId: bundle.book.id } });

    // Funnel: customer approved the book (keyed on book id, no PII).
    await captureServer("book_approved", bundle.book.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approval failed" },
      { status: 500 },
    );
  }
}
