/**
 * Book access tokens are bearer credentials: the /book/<token> URL is the only
 * thing guarding a customer's book (and the photos inside it). Telemetry must
 * never store it. Shared by the Sentry configs and the PostHog provider.
 */
export function redactBookTokens(value: string): string {
  return value.replace(/\/(book|samples)\/[^/?#]+/g, "/$1/[token]");
}

type UrlBearing = {
  request?: { url?: string };
  transaction?: string;
  breadcrumbs?: { data?: Record<string, unknown> }[];
};

/** Scrub token-bearing URLs from a Sentry event (error or transaction). */
export function scrubSentryEvent<T extends UrlBearing>(event: T): T {
  if (event.request?.url) event.request.url = redactBookTokens(event.request.url);
  if (event.transaction) event.transaction = redactBookTokens(event.transaction);
  for (const crumb of event.breadcrumbs ?? []) {
    const data = crumb.data;
    if (!data) continue;
    for (const key of ["url", "to", "from"]) {
      if (typeof data[key] === "string") data[key] = redactBookTokens(data[key] as string);
    }
  }
  return event;
}
