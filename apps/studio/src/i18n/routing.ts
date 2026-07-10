import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES } from "./config";

/**
 * Path-based locale routing (LAUNCH-PLAN.md O11). `as-needed` keeps English
 * unprefixed at `/` and serves German under `/de/...`. Slugs stay English
 * (they are DB ids); only the locale segment is added.
 *
 * `localeCookie` points next-intl at our own cookie (also set by the footer
 * switcher via POST /api/locale) so the two stay in sync.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeCookie: {
    name: LOCALE_COOKIE,
    maxAge: 60 * 60 * 24 * 365,
  },
});
