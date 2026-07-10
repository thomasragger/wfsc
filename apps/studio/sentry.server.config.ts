import * as Sentry from '@sentry/nextjs';

// No-ops when SENTRY_DSN is unset (local dev without Sentry configured).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,
});
