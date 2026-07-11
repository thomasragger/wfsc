import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { LOCALE_COOKIE, isLocale } from "./i18n/config";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/** DACH countries read German; everyone else reads English. */
const DACH = new Set(["DE", "AT", "CH", "LI"]);

/**
 * Locale negotiation only (LAUNCH-PLAN.md O11) — no rate limiting or other
 * concerns live here. Order: an explicit `wfsc_locale` cookie wins; otherwise
 * the visitor's country (Vercel geo header) picks de for DACH, else en. We
 * prime the cookie next-intl reads so geo — not Accept-Language — drives
 * first-visit detection, then hand off to next-intl for prefixing/redirects.
 */
export default function middleware(request: NextRequest) {
  // The internal admin area (/admin) lives OUTSIDE the locale tree: it must
  // never be locale-prefixed or redirected. It is also excluded by the matcher
  // below; this early return is belt-and-braces.
  if (request.nextUrl.pathname.startsWith("/admin")) return;

  // Expose the request path to server components (hreflang alternates in the
  // [locale] layout read this). Harmless if the runtime ignores the mutation.
  try {
    request.headers.set("x-pathname", request.nextUrl.pathname);
  } catch {
    // request headers immutable in this runtime — alternates fall back to "/"
  }

  if (!isLocale(request.cookies.get(LOCALE_COOKIE)?.value)) {
    const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
    request.cookies.set(LOCALE_COOKIE, country && DACH.has(country) ? "de" : "en");
  }

  return handleI18nRouting(request);
}

export const config = {
  // Skip API routes, the Sentry tunnel, the root OG image, Next internals and
  // any file with an extension (favicon, images, sitemap.xml, robots.txt …).
  matcher: ["/((?!api|admin|monitoring|opengraph-image|_next|_vercel|.*\\..*).*)"],
};
