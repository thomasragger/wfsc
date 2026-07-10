import { siteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Shared assets for generative share cards: real brand fonts, the logo as a
 * data URI, and a few real sample-book mockups. Everything is cached at
 * module level (warm lambdas render repeat cards without refetching) and
 * every loader degrades to null/[] so a network hiccup can never break a card.
 */

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();

/** TTF for satori via Google Fonts (css2 without a browser UA serves truetype). */
export function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`;
  const cached = fontCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const css = await fetch(
        `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
        { headers: { "User-Agent": "curl/8" } },
      ).then((r) => r.text());
      const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
      if (!url) return null;
      return await fetch(url).then((r) => r.arrayBuffer());
    } catch {
      return null;
    }
  })();
  fontCache.set(key, promise);
  return promise;
}

let logoCache: Promise<string | null> | null = null;

/** The landscape logo as a data URI (satori-safe, no cross-request fetch). */
export function loadLogoDataUri(): Promise<string | null> {
  logoCache ??= (async () => {
    try {
      const res = await fetch(`${siteUrl()}/logo-landscape.png`);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  })();
  return logoCache;
}

/** Up to `count` real sample-book mockup shots (public renders bucket). */
export async function loadSampleMockups(count: number): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin()
      .from("books")
      .select("mockup_image_url")
      .eq("is_sample", true)
      .not("mockup_image_url", "is", null)
      .order("created_at", { ascending: true })
      .limit(count);
    return (data ?? [])
      .map((r) => r.mockup_image_url as string)
      .filter((u) => u.startsWith("http"));
  } catch {
    return [];
  }
}
