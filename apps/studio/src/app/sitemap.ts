import type { MetadataRoute } from "next";

import { supabaseAdmin } from "@/lib/supabase";

import { siteUrl } from "@/lib/site-url";

const SITE_URL = siteUrl();

// Sitemap reads live catalog data; never cache a stale snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function url(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/**
 * Public sitemap: hand-curated static routes plus every crawlable catalog page
 * (audience categories, occasions, active templates, sample books) pulled from
 * Supabase. Data access is best-effort: if Supabase is unreachable the sitemap
 * still lists the static routes rather than failing the build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: url("/create"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: url("/books"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: url("/samples"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: url("/artists"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: url("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: url("/imprint"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: url("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: url("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: url("/returns"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const dynamicEntries: MetadataRoute.Sitemap = [];

  try {
    const db = supabaseAdmin();
    const [categories, occasions, templates, samples] = await Promise.all([
      db.from("template_categories").select("id"),
      db.from("occasion_categories").select("id"),
      db.from("story_templates").select("id").eq("is_active", true),
      db.from("books").select("access_token").eq("is_sample", true),
    ]);

    for (const c of (categories.data ?? []) as { id: string }[]) {
      dynamicEntries.push({
        url: url(`/for/${c.id}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    for (const o of (occasions.data ?? []) as { id: string }[]) {
      dynamicEntries.push({
        url: url(`/occasions/${o.id}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const t of (templates.data ?? []) as { id: string }[]) {
      dynamicEntries.push({
        url: url(`/create?template=${encodeURIComponent(t.id)}`),
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
    for (const s of (samples.data ?? []) as { access_token: string }[]) {
      dynamicEntries.push({
        url: url(`/samples/${encodeURIComponent(s.access_token)}`),
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch {
    // Supabase unavailable: fall back to static routes only.
  }

  return [...staticEntries, ...dynamicEntries];
}
