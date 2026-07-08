"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ArtPlaceholder, Doodle } from "@/components/decor";
import { Button, ButtonLink } from "@/components/ui/button";
import { IconCart, IconClose } from "@/components/ui/icons";
import { getCart, removeCartLine } from "@/lib/client-api";
import type { EnrichedCart } from "@/lib/cart";

function money(m: { amount: string; currencyCode: string }): string {
  const n = Number(m.amount);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: m.currencyCode }).format(n);
  } catch {
    return `${m.amount} ${m.currencyCode}`;
  }
}

/** Cart icon + badge in the nav, opening a slide-in drawer. */
export function CartButton() {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<EnrichedCart | null>(null);

  const refresh = useCallback(() => {
    getCart()
      .then(setCart)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const count = cart?.totalQuantity ?? 0;

  return (
    <>
      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-ink/5"
        aria-label={`Cart${count ? ` (${count})` : ""}`}
        onClick={() => {
          setOpen(true);
          refresh();
        }}
      >
        <IconCart />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-extrabold text-white">
            {count}
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            // Portalled to <body> so it escapes the sticky header's stacking
            // context and reliably overlays the whole page.
            <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Cart" aria-modal="true">
              <div
                className="animate-fade-in absolute inset-0 bg-ink/25 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div className="animate-sheet-in absolute right-0 top-0 flex h-full w-full max-w-[26rem] flex-col bg-cream shadow-[-24px_0_60px_-24px_rgba(118,30,11,0.3)]">
                <div className="flex items-center justify-between px-6 pb-4 pt-6">
                  <p className="font-display text-xl font-extrabold text-ink">Your cart</p>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                    aria-label="Close cart"
                    onClick={() => setOpen(false)}
                  >
                    <IconClose className="h-5 w-5" />
                  </button>
                </div>
                <CartView cart={cart} onChange={setCart} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** The cart contents — shared by the drawer and the /cart page. */
export function CartView({
  cart,
  onChange,
}: {
  cart: EnrichedCart | null;
  onChange: (cart: EnrichedCart | null) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(lineId: string) {
    setBusy(lineId);
    try {
      onChange(await removeCartLine(lineId));
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-16 text-center">
        <Doodle src="cloud.png" size={64} className="animate-float opacity-80" />
        <div>
          <p className="font-display text-lg font-extrabold text-ink">Your cart is empty</p>
          <p className="mx-auto mt-1 max-w-[15rem] text-sm text-ink-soft">
            Make a book you love and it&rsquo;ll wait for you right here.
          </p>
        </div>
        <ButtonLink href="/books" variant="secondary" size="sm">
          Browse books
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <ul className="flex-1 divide-y divide-ink/5 overflow-y-auto px-5">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex items-center gap-4 py-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-lavender">
              {line.bookImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={line.bookImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ArtPlaceholder />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-extrabold text-ink">
                {line.bookTitle ?? "Your storybook"}
              </p>
              <p className="text-xs text-ink-soft">{line.variantTitle}</p>
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                disabled={busy === line.id}
                onClick={() => void remove(line.id)}
              >
                {busy === line.id ? "Removing…" : "Remove"}
              </button>
            </div>
            <p className="shrink-0 font-display font-extrabold text-ink">{money(line.price)}</p>
          </li>
        ))}
      </ul>

      <div className="border-t border-ink/5 p-5">
        <div className="flex items-center justify-between font-display text-lg font-extrabold text-ink">
          <span>Subtotal</span>
          <span>{money(cart.subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">Shipping &amp; taxes calculated at checkout.</p>
        <a href={cart.checkoutUrl} className="mt-4 block">
          <Button className="w-full" size="lg">
            Checkout
          </Button>
        </a>
      </div>
    </div>
  );
}
