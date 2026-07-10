"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LOCALES, type Locale } from "@/i18n/config";

const LABELS: Record<Locale, string> = { en: "English", de: "Deutsch" };

/**
 * Explicit language choice: sets the wfsc_locale cookie (wins over geo
 * detection, see src/i18n/request.ts) and refreshes the server-rendered tree.
 * Country/shipping needs no equivalent: Shopify checkout collects the address
 * and Lulu auto-routes EU/US production.
 */
export function LanguageSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  async function choose(locale: Locale) {
    if (locale === current || saving) return;
    setSaving(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
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
          disabled={saving || isPending}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
            locale === current
              ? "bg-coral text-white"
              : "text-ink-soft hover:text-coral"
          }`}
        >
          {LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
