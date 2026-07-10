import { hasLocale } from "next-intl";
import { getLocale, getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import { detectRegion } from "@/lib/region";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeForRegion, type Locale } from "./config";
import { routing } from "./routing";

/**
 * Cookie/region fallback used when there is no locale segment (API routes,
 * static context): an explicit cookie (the switcher) wins, then the visitor's
 * region (DACH -> de), then English.
 */
async function cookieGeoLocale(): Promise<Locale> {
  try {
    const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(cookie)) return cookie;
  } catch {
    // static context without request cookies
  }
  return localeForRegion(await detectRegion());
}

/**
 * Locale resolution for the many server loaders and API routes that import
 * this (O11 keeps the signature stable). In a page context `getLocale()`
 * returns the locale from the URL segment; in an API route (no segment) it
 * resolves via `getRequestConfig` below, which falls back to cookie/region.
 */
export async function resolveLocale(): Promise<Locale> {
  try {
    const locale = await getLocale();
    if (isLocale(locale)) return locale;
  } catch {
    // no next-intl request context — fall through to cookie/region
  }
  return cookieGeoLocale();
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

export default getRequestConfig(async ({ requestLocale }) => {
  // The URL segment (page context) wins; API routes have none, so fall back
  // to the cookie/region rule. Never calls resolveLocale (which calls
  // getLocale, which lands back here) — avoids recursion.
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : await cookieGeoLocale();

  const base = (await import("../../messages/en.json")).default as Messages;
  const messages =
    locale === DEFAULT_LOCALE
      ? base
      : deepMerge(base, (await import(`../../messages/${locale}.json`)).default as Messages);
  return { locale, messages };
});
