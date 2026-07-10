import { cookies } from "next/headers";

import type { BookFormat } from "@/lib/book-payload";
import { cartFetch, type CartContents, type CartLine } from "@/lib/shopify";
import { signUrl } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Server-side cart helpers: the Storefront cart id lives in an httpOnly
 * cookie, and cart lines are enriched with each book's real title + cover
 * (the Shopify product is a single generic "storybook", so the line's own
 * title isn't meaningful on its own).
 */

const CART_COOKIE = "wfsc_cart";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days (Shopify carts persist ~10 days idle)
};

export async function getCartId(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

export async function setCartId(id: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, id, COOKIE_OPTS);
}

export async function clearCartId(): Promise<void> {
  (await cookies()).delete(CART_COOKIE);
}

export function variantForFormat(format: BookFormat): string | null {
  const byFormat: Record<BookFormat, string | undefined> = {
    board: process.env.SHOPIFY_VARIANT_BOARD,
    softcover: process.env.SHOPIFY_VARIANT_SOFTCOVER,
    hardcover: process.env.SHOPIFY_VARIANT_HARDCOVER,
  };
  return byFormat[format] ?? null;
}

export interface EnrichedCartLine extends CartLine {
  bookTitle: string | null;
  bookImageUrl: string | null;
  bookToken: string | null;
}

export interface EnrichedCart extends Omit<CartContents, "lines"> {
  lines: EnrichedCartLine[];
}

/** Attach each line's book title + cover from Supabase (by `_book_id`). */
export async function enrichCart(cart: CartContents): Promise<EnrichedCart> {
  const ids = cart.lines.map((l) => l.bookId).filter((v): v is string => !!v);
  const byId = new Map<string, { title: string | null; image: string | null; token: string | null }>();
  if (ids.length > 0) {
    try {
      const { data } = await supabaseAdmin()
        .from("books")
        .select("id, title, cover_image_url, mockup_image_url, access_token")
        .in("id", ids);
      for (const b of data ?? []) {
        byId.set(b.id as string, {
          title: (b.title ?? null) as string | null,
          // Covers live in a private bucket — sign for display.
          image: await signUrl(((b.mockup_image_url ?? b.cover_image_url) ?? null) as string | null),
          token: (b.access_token ?? null) as string | null,
        });
      }
    } catch {
      /* enrichment is best-effort */
    }
  }
  return {
    ...cart,
    lines: cart.lines.map((l) => {
      const b = l.bookId ? byId.get(l.bookId) : undefined;
      return {
        ...l,
        bookTitle: b?.title ?? null,
        bookImageUrl: b?.image ?? null,
        bookToken: b?.token ?? null,
      };
    }),
  };
}

/** Read + enrich the current cart, syncing the cookie if the cart expired. */
export async function readCart(): Promise<EnrichedCart | null> {
  const id = await getCartId();
  if (!id) return null;
  const cart = await cartFetch(id);
  if (!cart) {
    await clearCartId();
    return null;
  }
  return enrichCart(cart);
}
