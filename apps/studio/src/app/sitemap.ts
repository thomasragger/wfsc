import type { MetadataRoute } from "next";

import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { supabaseAdmin } from "@/lib/supabase";

import { siteUrl } from "@/lib/site-url";

const SITE_URL = siteUrl();

// Sitemap reads live catalog data; never cache a stale snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function url(path: string): string {
  return new URL(path, SITE_URL).toString();
}

type EntryMeta = Omit<MetadataRoute.Sitemap[number], "url" | "alternates" | "lastModified">;

/**
 * Expand one logical route into one sitemap entry per locale (O11: both URL
 * variants per entry), each carrying `alternates.languages` so Google links
 * the English and German pages as translations of one another. `pathname` is
 * the internal (English) href; `getPathname` adds the `/de` prefix.
 */
function localizedEntries(
  pathname: string,
  meta: EntryMeta,
  now: Date,
  query = "",
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, url(getPathname({ locale, href: pathname }) + query)]),
  );
  return routing.locales.map((locale) => ({
    url: url(getPathname({ locale, href: pathname }) + query),
    lastModified: now,
    alternates: { languages },
    ...meta,
  }));
}

/**
 * Public sitemap: hand-curated static routes plus every crawlable catalog page
 * (audience categories, occasions, active templates, sample books) pulled from
 * Supabase. Both locales (en + de) are emitted for every route. Data access is
 * best-effort: if Supabase is unreachable the sitemap still lists the static
 * routes rather than failing the build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: [string, EntryMeta][] = [
    ["/", { changeFrequency: "weekly", priority: 1 }],
    ["/create", { changeFrequency: "monthly", priority: 0.9 }],
    ["/books", { changeFrequency: "weekly", priority: 0.8 }],
    ["/samples", { changeFrequency: "weekly", priority: 0.7 }],
    ["/artists", { changeFrequency: "monthly", priority: 0.5 }],
    ["/about", { changeFrequency: "monthly", priority: 0.4 }],
    ["/contact", { changeFrequency: "yearly", priority: 0.3 }],
    ["/imprint", { changeFrequency: "yearly", priority: 0.2 }],
    ["/privacy", { changeFrequency: "yearly", priority: 0.2 }],
    ["/terms", { changeFrequency: "yearly", priority: 0.2 }],
    ["/returns", { changeFrequency: "yearly", priority: 0.2 }],
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.flatMap(([pathname, meta]) =>
    localizedEntries(pathname, meta, now),
  );

  try {
    const db = supabaseAdmin();
    const [categories, occasions, templates, samples] = await Promise.all([
      db.from("template_categories").select("id"),
      db.from("occasion_categories").select("id"),
      db.from("story_templates").select("id").eq("is_active", true),
      db.from("books").select("access_token").eq("is_sample", true),
    ]);

    for (const c of (categories.data ?? []) as { id: string }[]) {
      entries.push(...localizedEntries(`/for/${c.id}`, { changeFrequency: "weekly", priority: 0.7 }, now));
    }
    for (const o of (occasions.data ?? []) as { id: string }[]) {
      entries.push(
        ...localizedEntries(`/occasions/${o.id}`, { changeFrequency: "weekly", priority: 0.6 }, now),
      );
    }
    for (const t of (templates.data ?? []) as { id: string }[]) {
      entries.push(
        ...localizedEntries(
          "/create",
          { changeFrequency: "monthly", priority: 0.5 },
          now,
          `?template=${encodeURIComponent(t.id)}`,
        ),
      );
    }
    for (const s of (samples.data ?? []) as { access_token: string }[]) {
      entries.push(
        ...localizedEntries(
          `/samples/${encodeURIComponent(s.access_token)}`,
          { changeFrequency: "monthly", priority: 0.5 },
          now,
        ),
      );
    }
  } catch {
    // Supabase unavailable: fall back to static routes only.
  }

  return entries;
}
