import * as Sentry from '@sentry/nextjs';

import { scrubSentryEvent } from '@/lib/redact';

// No-ops when the DSN is unset. Session replay: 10% baseline, 100% on error.
// Book URLs carry the access token (a bearer credential) — scrub it from
// every event, transaction, and breadcrumb before it leaves the browser.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [Sentry.replayIntegration()],
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
  beforeBreadcrumb: (crumb) => {
    if (crumb.data) scrubSentryEvent({ breadcrumbs: [{ data: crumb.data }] });
    return crumb;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
