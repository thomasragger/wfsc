/**
 * Environment-driven site origin + launch gate.
 *
 * - `siteUrl()`: NEXT_PUBLIC_SITE_URL when set (the launched, real domain),
 *   else Vercel's production URL for this project (staging on *.vercel.app),
 *   else localhost. Canonicals, OG urls, sitemap, and robots all derive from
 *   this, so every environment self-describes correctly.
 * - `isLaunched()`: true only when NEXT_PUBLIC_SITE_URL is set. Until then the
 *   site serves noindex + a disallow-all robots.txt so the staging domain
 *   never enters a search index. Going live = set NEXT_PUBLIC_SITE_URL (and
 *   STUDIO_URL for email links) to https://warmfuzzystoryclub.com, connect
 *   the domain, redeploy.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export function isLaunched(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SITE_URL);
}
