export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie set by the locale switcher; wins over geo detection. */
export const LOCALE_COOKIE = "wfsc_locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Site language for a visitor region (DACH launch market reads German). */
export function localeForRegion(region: "dach" | "us"): Locale {
  return region === "dach" ? "de" : "en";
}
