import { NextResponse } from "next/server";
import { z } from "zod";

import { clearCartId, enrichCart, getCartId } from "@/lib/cart";
import { cartRemoveLine } from "@/lib/shopify";

export const runtime = "nodejs";

const RemoveSchema = z.object({ lineId: z.string().min(1) });

/** POST /api/cart/remove — remove a line from the cart. */
export async function POST(request: Request) {
  try {
    const parsed = RemoveSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Missing lineId" }, { status: 400 });

    const cartId = await getCartId();
    if (!cartId) return NextResponse.json({ cart: null });

    const cart = await cartRemoveLine(cartId, parsed.data.lineId);
    if (!cart) {
      await clearCartId();
      return NextResponse.json({ cart: null });
    }
    return NextResponse.json({ cart: await enrichCart(cart) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't update cart" },
      { status: 500 },
    );
  }
}
