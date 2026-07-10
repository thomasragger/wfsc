import * as Sentry from '@sentry/nextjs';

import { scrubSentryEvent } from './src/lib/redact';

// No-ops when SENTRY_DSN is unset (local dev without Sentry configured).
// Request URLs for /book/<token> carry a bearer credential — scrub before send.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});
