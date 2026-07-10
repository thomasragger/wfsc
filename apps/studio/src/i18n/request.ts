import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import { detectRegion } from "@/lib/region";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeForRegion, type Locale } from "./config";

/**
 * Locale resolution without path routing (see LAUNCH-PLAN.md F4): an explicit
 * cookie (the switcher) wins, then the visitor's region (DACH -> de), then
 * English. Messages deep-merge over English so untranslated keys fall back
 * per-key instead of erroring.
 */
export async function resolveLocale(): Promise<Locale> {
  try {
    const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(cookie)) return cookie;
  } catch {
    // static context without request cookies
  }
  return localeForRegion(await detectRegion());
}

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (
      value && typeof value === "object" && !Array.isArray(value) &&
      existing && typeof existing === "object" && !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing as Messages, value as Messages);
    } else if (value !== undefined && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const base = (await import("../../messages/en.json")).default as Messages;
  const messages =
    locale === DEFAULT_LOCALE
      ? base
      : deepMerge(base, (await import(`../../messages/${locale}.json`)).default as Messages);
  return { locale, messages };
});
