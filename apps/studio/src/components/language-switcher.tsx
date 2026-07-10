"use client";

import { useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { LOCALES, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

const LABELS: Record<Locale, string> = { en: "English", de: "Deutsch" };
const COMPACT_LABELS: Record<Locale, string> = { en: "EN", de: "DE" };

/**
 * Explicit language choice (LAUNCH-PLAN.md O11): navigates to the *same*
 * pathname under the chosen locale (so `/de/samples/x` ⇄ `/samples/x`) and
 * persists the wfsc_locale cookie so the choice sticks on the next visit and
 * wins over geo detection (see src/i18n/request.ts). Country/shipping needs no
 * equivalent: Shopify checkout collects the address and Lulu auto-routes
 * EU/US production.
 */
export function LanguageSwitcher({ current, compact = false }: { current: string; compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname(); // locale-stripped current path
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    // Persist the choice; the navigation below performs the actual switch.
    void fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    const query = searchParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(href, { locale });
    });
  }

  return (
    <div
      role="group"
      aria-label="Language / Sprache"
      className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/70 p-1"
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => choose(locale)}
          aria-pressed={locale === current}
          disabled={isPending}
          className={`rounded-full ${compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"} font-bold transition-colors ${
            locale === current
              ? "bg-coral text-white"
              : "text-ink-soft hover:text-coral"
          }`}
        >
          {compact ? COMPACT_LABELS[locale] : LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
