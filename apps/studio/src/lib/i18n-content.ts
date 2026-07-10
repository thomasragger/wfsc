import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Catalog translations: each translatable table carries a `translations`
 * jsonb column shaped { "<locale>": { "<field>": "<value>" } }; base columns
 * stay English. Overlay the locale's fields onto the row before mapping —
 * missing locales/fields fall back to English per-field.
 */
export function localizeRow<T extends Record<string, unknown>>(row: T, locale: string): T {
  if (locale === DEFAULT_LOCALE) return row;
  const overlay = (
    row.translations as Record<string, Record<string, unknown>> | null | undefined
  )?.[locale];
  if (!overlay) return row;
  const out: Record<string, unknown> = { ...row };
  for (const [field, value] of Object.entries(overlay)) {
    if (value !== null && value !== undefined && value !== "") out[field] = value;
  }
  return out as T;
}
