import type { MetadataRoute } from "next";

import { isLaunched, siteUrl } from "@/lib/site-url";

/**
 * Robots policy.
 *
 * Pre-launch (NEXT_PUBLIC_SITE_URL unset): disallow everything — the staging
 * domain must never enter a search index.
 *
 * Launched: private/creator surfaces stay out of the index:
 *  - /book/*  token-gated books in progress
 *  - /api/*   backend routes
 *  - /styleguide  internal design reference
 *  - /monitoring  Sentry tunnel
 */
export default function robots(): MetadataRoute.Robots {
  if (!isLaunched()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/book/", "/api/", "/styleguide", "/monitoring"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
    host: siteUrl(),
  };
}
