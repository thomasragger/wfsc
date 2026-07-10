import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchBookBundle } from "@/lib/books";
import { variantForFormat } from "@/lib/cart";
import { createCheckout } from "@/lib/shopify";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

const CheckoutSchema = z.object({
  format: z.enum(["board", "softcover", "hardcover"]),
});

/**
 * POST /api/books/[token]/checkout — record the chosen format and create a
 * Shopify checkout for it.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const parsed = CheckoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Pick a book format" }, { status: 400 });
    }
    const { format } = parsed.data;

    const bundle = await fetchBookBundle(token);
    if (!bundle) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    if (bundle.book.status !== "preview_ready") {
      return NextResponse.json(
        { error: "This book isn't ready for checkout" },
        { status: 409 },
      );
    }

    const variantId = variantForFormat(format);
    if (!variantId) {
      return NextResponse.json(
        { error: `Shopify variant for ${format} is not configured` },
        { status: 500 },
      );
    }

    const db = supabaseAdmin();
    const { error } = await db.from("books").update({ format }).eq("id", bundle.book.id);
    if (error) throw new Error(error.message);

    const { checkoutUrl } = await createCheckout({
      variantId,
      bookId: bundle.book.id,
      bookTitle: bundle.book.title ?? "Your Warm Fuzzy storybook",
    });

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
