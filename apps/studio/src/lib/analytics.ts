/**
 * Server-side PostHog capture for funnel events that only the server can see
 * (book created, checkout started, purchase, review opened, approved).
 *
 * Cookieless + no PII: events are keyed on the book id (distinct id
 * `book_<id>`) and properties must never carry names, emails, photo URLs or
 * memory text. Degrades to a no-op when NEXT_PUBLIC_POSTHOG_KEY is unset so
 * dev/preview never crash.
 */
import { PostHog } from "posthog-node";

type EventProps = Record<string, string | number | boolean | null | undefined>;

const DEFAULT_HOST = "https://eu.i.posthog.com";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST,
      // Serverless: flush every event immediately rather than buffering across
      // invocations that may be frozen/killed before a timed flush fires.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Capture a server-side funnel event keyed on a book id. Never throws: an
 * analytics failure must not break the request that raised it.
 */
export async function captureServer(
  event: string,
  bookId: string,
  properties?: EventProps,
): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({
      distinctId: `book_${bookId}`,
      event,
      properties: { ...properties, book_id: bookId },
    });
    await c.flush();
  } catch (err) {
    console.error(`[analytics] capture failed for "${event}"`, err);
  }
}
