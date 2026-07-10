import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";

const SITE_URL = siteUrl();

/** Strip the locale prefix from a request path to get the internal href. */
function toHref(pathname: string): string {
  const clean = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (clean === `/${locale}`) return "/";
    if (clean.startsWith(`/${locale}/`)) return clean.slice(locale.length + 1);
  }
  return clean;
}

/**
 * hreflang + canonical for every page under the locale segment (LAUNCH-PLAN.md
 * O11). Pages that set their own title/description inherit this because Next
 * merges metadata per-field; none of them override `alternates`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const href = toHref((await headers()).get("x-pathname") ?? "/");
  const abs = (loc: Locale) => new URL(getPathname({ locale: loc, href }), SITE_URL).toString();
  const self: Locale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  return {
    alternates: {
      canonical: abs(self),
      languages: {
        en: abs("en"),
        de: abs("de"),
        "x-default": abs("en"),
      },
    },
  };
}

/**
 * Locale segment boundary: validate the segment (a bad value is a 404) and pin
 * the request locale. The `<html>`, fonts and providers stay in the root
 * layout, which reads the same resolved locale via `getLocale()`.
 */
export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return children;
}
