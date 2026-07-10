import { NextResponse } from "next/server";
import { z } from "zod";

import { FONT_PAIRINGS, type FontPairingId } from "@wfsc/book-engine";

import { EDITABLE_BOOK_STATUSES, type BookStatus } from "@/lib/book-payload";
import { fetchBookBundle } from "@/lib/books";
import { deleteBookData } from "@/lib/deletion";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/** GET /api/books/[token] — full customer-facing book payload. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const bundle = await fetchBookBundle(token);
    if (!bundle) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    return NextResponse.json({ book: bundle.payload });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load book" },
      { status: 500 },
    );
  }
}

/** Statuses where an order is actively being produced — deletion would break
 *  fulfillment, so the customer has to wait (or cancel via support). */
const DELETE_BLOCKED_STATUSES: BookStatus[] = [
  "purchased",
  "generating",
  "ready_for_review",
  "approved",
  "submitted_to_print",
];

/**
 * DELETE /api/books/[token] — GDPR erasure: removes the book, its people,
 * spreads, and every stored asset (photos, character sheets, renders, PDFs).
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const bundle = await fetchBookBundle(token);
    if (!bundle) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    if (DELETE_BLOCKED_STATUSES.includes(bundle.book.status)) {
      return NextResponse.json(
        {
          error:
            "This book has an order in progress and can't be deleted right now. Contact hello@warmfuzzystoryclub.com and we'll take care of it.",
        },
        { status: 409 },
      );
    }
    await deleteBookData(bundle.book.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete book" },
      { status: 500 },
    );
  }
}

const fontPairingIds = Object.keys(FONT_PAIRINGS) as [FontPairingId, ...FontPairingId[]];

const PatchBookSchema = z
  .object({
    greeting: z.string().trim().max(600).nullable().optional(),
    fontPairing: z.enum(fontPairingIds).optional(),
    title: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

/** PATCH /api/books/[token] — customer edits to greeting/font pairing/title. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const parsed = PatchBookSchema.safeParse(await request.json());
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
    if (!EDITABLE_BOOK_STATUSES.includes(bundle.book.status)) {
      return NextResponse.json(
        { error: "This book can no longer be edited" },
        { status: 409 },
      );
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.greeting !== undefined) update.greeting = parsed.data.greeting;
    if (parsed.data.fontPairing !== undefined) update.font_pairing = parsed.data.fontPairing;
    if (parsed.data.title !== undefined) update.title = parsed.data.title;

    const db = supabaseAdmin();
    const { error } = await db.from("books").update(update).eq("id", bundle.book.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update book" },
      { status: 500 },
    );
  }
}
