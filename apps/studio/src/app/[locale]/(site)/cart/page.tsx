"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { CartView } from "@/components/cart";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCart } from "@/lib/client-api";
import type { EnrichedCart } from "@/lib/cart";

export default function CartPage() {
  const t = useTranslations("cart");
  const [cart, setCart] = useState<EnrichedCart | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCart()
      .then(setCart)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">{t("heading")}</h1>
      <p className="mt-2 text-ink-soft">{t("intro")}</p>

      <Card className="mt-8 overflow-hidden p-0">
        {loaded ? (
          <div className="flex min-h-[16rem] flex-col">
            <CartView cart={cart} onChange={setCart} />
          </div>
        ) : (
          <div className="flex min-h-[16rem] flex-col gap-4 p-5" role="status" aria-label={t("loadingAria")}>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 shrink-0" rounded="rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-14" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6 text-center">
        <ButtonLink href="/books" variant="ghost">
          {t("keepBrowsing")}
        </ButtonLink>
      </div>
    </div>
  );
}
