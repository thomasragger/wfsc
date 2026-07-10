import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchBookBundle } from "@/lib/books";
import { enrichCart, getCartId, readCart, setCartId, variantForFormat } from "@/lib/cart";
import {
  RATE_LIMIT_COPY,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
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
    const limit = await checkRateLimit("cart-ip", getClientIp(request));
    if (!limit.ok) {
      return rateLimitResponse(RATE_LIMIT_COPY.checkout, limit.retryAfter);
    }

    const parsed = AddSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Pick softcover or hardcover" }, { status: 400 });
    }
    const { token, format } = parsed.data;

    const bundle = await fetchBookBundle(token);
    if (!bundle) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    // Same gate as checkout: only a finished preview can be bought (paying for
    // a book mid-generation would strand the order without a story to build).
    if (bundle.book.status !== "preview_ready") {
      return NextResponse.json(
        { error: "This book isn't ready for checkout yet" },
        { status: 409 },
      );
    }

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
