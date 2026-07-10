"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { Suspense, useEffect } from "react";

/**
 * PostHog analytics, EU host, cookieless.
 *
 * `persistence: "memory"` keeps everything in-tab (no cookies, no
 * localStorage), so the site needs no cookie banner. Trade-off: no
 * cross-session visitor stitching (decided 2026-07-10). Autocapture and
 * session recording are off; we emit explicit funnel events and Sentry owns
 * replay. No-ops entirely when NEXT_PUBLIC_POSTHOG_KEY is unset (dev/preview).
 */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    persistence: "memory", // cookieless: no cookie banner required
    capture_pageview: false, // captured manually for the app router (below)
    capture_pageleave: false,
    autocapture: false, // we emit explicit funnel events instead
    disable_session_recording: true, // Sentry owns replay
  });
}

/** Manual pageview capture on app-router navigations. */
function PageviewTracker() {
  const posthogClient = usePostHog();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthogClient || !pathname) return;
    const query = searchParams?.toString();
    posthogClient.capture("$pageview", {
      $current_url: window.origin + pathname + (query ? `?${query}` : ""),
    });
  }, [posthogClient, pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // When unconfigured (dev/preview) render children untouched: no provider, so
  // usePostHog() callers get undefined and their captures no-op.
  if (!POSTHOG_KEY) return <>{children}</>;
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
