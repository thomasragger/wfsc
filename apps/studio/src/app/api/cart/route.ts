import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchBookBundle } from "@/lib/books";
import { enrichCart, getCartId, readCart, setCartId, variantForFormat } from "@/lib/cart";
import { cartAddBook } from "@/lib/shopify";

export const runtime = "nodejs";

/** GET /api/cart — current cart contents (or null). */
export async function GET() {
  try {
    const cart = await readCart();
    return NextResponse.json({ cart });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load cart" },
      { status: 500 },
    );
  }
}

const AddSchema = z.object({
  token: z.string().min(1),
  format: z.enum(["board", "softcover", "hardcover"]),
});

/** POST /api/cart — add a finished book (by preview token) to the cart. */
export async function POST(request: Request) {
  try {
    const parsed = AddSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Pick softcover or hardcover" }, { status: 400 });
    }
    const { token, format } = parsed.data;

    const bundle = await fetchBookBundle(token);
    if (!bundle) return NextResponse.json({ error: "Book not found" }, { status: 404 });

    const variantId = variantForFormat(format);
    if (!variantId) {
      return NextResponse.json({ error: `Shopify variant for ${format} is not configured` }, { status: 500 });
    }

    const cart = await cartAddBook({
      cartId: await getCartId(),
      variantId,
      bookId: bundle.book.id,
      bookTitle: bundle.book.title ?? "Your Warm Fuzzy storybook",
    });
    await setCartId(cart.id);

    return NextResponse.json({ cart: await enrichCart(cart) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't add to cart" },
      { status: 500 },
    );
  }
}
