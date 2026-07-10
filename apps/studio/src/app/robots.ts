import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://warmfuzzystoryclub.com";

/**
 * Robots policy. Private/creator surfaces stay out of the index:
 *  - /book/*  token-gated books in progress
 *  - /api/*   backend routes
 *  - /styleguide  internal design reference
 *  - /monitoring  Sentry tunnel
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/book/", "/api/", "/styleguide", "/monitoring"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
    host: SITE_URL,
  };
}
