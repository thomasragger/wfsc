import path from "node:path";

import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Monorepo root (silences the multi-lockfile workspace-root warning).
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

// Source-map upload only runs when SENTRY_AUTH_TOKEN is set (CI/Vercel);
// locally this wrapper is inert.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Upload source maps for readable stack traces, then delete them from the
  // client bundle so they never ship publicly.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  tunnelRoute: "/monitoring", // dodge ad-blockers
  silent: !process.env.CI,
});
