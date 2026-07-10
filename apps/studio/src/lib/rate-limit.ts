import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

/**
 * Per-client rate limiting (workstream O5, per docs/rate-limit-spec.md).
 *
 * Sliding-window limits backed by Upstash Redis, enforced inside each route
 * handler (not middleware) so a limit can key on the request body (email,
 * book token) as well as the client IP.
 *
 * Degradation: if the Upstash env vars are absent (local dev) the limiters are
 * disabled and every check passes, with a one-time console note. A transient
 * Redis error also fails open so a Redis outage never blocks a real customer.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let warnedDisabled = false;

/** Lazily-built shared Redis client, or null when Upstash is not configured. */
const redis: Redis | null = (() => {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return null;
  }
  return new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
})();

function warnOnce(): void {
  if (warnedDisabled) return;
  warnedDisabled = true;
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL / _TOKEN not set. Rate limiting is disabled (fail open). Configure Upstash to enforce limits in production.",
  );
}

/** The distinct limits from the spec. */
export type RateLimitKind = "books-ip" | "books-email" | "uploads-ip" | "regenerate-book";

const limiterCache = new Map<RateLimitKind, Ratelimit>();

function limiterFor(kind: RateLimitKind): Ratelimit | null {
  if (!redis) {
    warnOnce();
    return null;
  }
  const cached = limiterCache.get(kind);
  if (cached) return cached;

  let limiter: Ratelimit;
  switch (kind) {
    case "books-ip":
      // Each create triggers paid preview generation.
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        prefix: "wfsc:books:ip",
        analytics: false,
      });
      break;
    case "books-email":
      // Stops a single caller rotating IPs.
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 d"),
        prefix: "wfsc:books:email",
        analytics: false,
      });
      break;
    case "uploads-ip":
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 h"),
        prefix: "wfsc:uploads:ip",
        analytics: false,
      });
      break;
    case "regenerate-book":
      // Complements the lifetime WFSC_MAX_REGENS_PER_BOOK cap.
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 d"),
        prefix: "wfsc:regen:book",
        analytics: false,
      });
      break;
  }
  limiterCache.set(kind, limiter);
  return limiter;
}

export interface RateLimitResult {
  /** true when the request is allowed (or limiting is disabled). */
  ok: boolean;
  /** Seconds until the window frees up (0 when allowed). */
  retryAfter: number;
}

/**
 * Read the client IP from proxy headers the Vercel/Next way: the first hop in
 * `x-forwarded-for`, then `x-real-ip`. A missing IP collapses to one shared
 * bucket ("unknown"), never an unlimited pass (per spec).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return "unknown";
}

/**
 * Consume one token from the given limit. Fails open (ok: true) when limiting
 * is disabled or Redis errors, so infrastructure problems never block a book.
 */
export async function checkRateLimit(
  kind: RateLimitKind,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = limiterFor(kind);
  if (!limiter) return { ok: true, retryAfter: 0 };
  try {
    const { success, reset } = await limiter.limit(identifier);
    const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    return { ok: success, retryAfter };
  } catch (err) {
    console.error(`[rate-limit] check failed for ${kind}, failing open`, err);
    return { ok: true, retryAfter: 0 };
  }
}

/** Friendly, customer-facing 429 copy per route (org rule: no em dashes). */
export const RATE_LIMIT_COPY = {
  books:
    "Whoa, that's a lot of storybooks! Please wait a little while before starting another one.",
  uploads: "Too many photos too quickly, give it a minute and try again.",
  regenerate: "You've redrawn quite a few pages just now. Give it a minute.",
} as const;

/**
 * Build the 429 response. `error` carries the friendly copy verbatim because
 * the client `request()` helper surfaces `error` directly to the customer;
 * `code` and `retryAfter` give richer clients structured data to work with.
 */
export function rateLimitResponse(copy: string, retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: copy, code: "rate_limited", retryAfter },
    {
      status: 429,
      headers: retryAfter > 0 ? { "Retry-After": String(retryAfter) } : undefined,
    },
  );
}
