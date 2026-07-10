import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

/**
 * Per-client rate limiting (workstream O5, per docs/rate-limit-spec.md),
 * backed by Postgres instead of Upstash to keep the service count down:
 * fixed-window counters in the `rate_limits` table via the atomic
 * `rate_limit_hit` RPC (migration 0013). At our request rates (single-digit
 * hits per client per hour on the guarded endpoints) Postgres is more than
 * enough; revisit Redis only if sustained abuse ever makes DB load visible.
 *
 * Enforced inside each route handler (not middleware) so a limit can key on
 * the request body (email, book token) as well as the client IP.
 *
 * Degradation: any database error fails open so an infrastructure problem
 * never blocks a real customer. The daily preview budget and per-book
 * lifetime caps remain independent backstops.
 */

/** The distinct limits from the spec: max hits per fixed window. */
export type RateLimitKind =
  | "books-ip"
  | "books-email"
  | "uploads-ip"
  | "regenerate-book"
  | "retry-book"
  | "checkout-ip"
  | "cart-ip";

const LIMITS: Record<RateLimitKind, { windowSeconds: number; max: number }> = {
  // Each create triggers paid preview generation.
  "books-ip": { windowSeconds: 60 * 60, max: 3 },
  // Stops a single caller rotating IPs.
  "books-email": { windowSeconds: 24 * 60 * 60, max: 5 },
  "uploads-ip": { windowSeconds: 60 * 60, max: 30 },
  // Complements the lifetime WFSC_MAX_REGENS_PER_BOOK cap.
  "regenerate-book": { windowSeconds: 24 * 60 * 60, max: 10 },
  // Each retry re-runs the paid preview pipeline.
  "retry-book": { windowSeconds: 60 * 60, max: 5 },
  // Shopify mutation cost.
  "checkout-ip": { windowSeconds: 60 * 60, max: 20 },
  "cart-ip": { windowSeconds: 60 * 60, max: 20 },
};

export interface RateLimitResult {
  /** true when the request is allowed (or limiting failed open). */
  ok: boolean;
  /** Seconds until the window frees up (0 when allowed). */
  retryAfter: number;
}

/**
 * Read the client IP from proxy headers. Order matters for spoof resistance:
 * `x-real-ip` is SET BY Vercel's edge (a client cannot forge it), whereas the
 * leftmost `x-forwarded-for` entry is client-supplied (Vercel appends the real
 * IP at the end, it does not strip attacker values). So: x-real-ip first, then
 * the RIGHTMOST forwarded hop. A missing IP collapses to one shared bucket
 * ("unknown"), never an unlimited pass (per spec).
 */
export function getClientIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }
  return "unknown";
}

/**
 * Consume one token from the given limit. Fails open (ok: true) when the
 * database errors, so infrastructure problems never block a book.
 */
export async function checkRateLimit(
  kind: RateLimitKind,
  identifier: string,
): Promise<RateLimitResult> {
  const { windowSeconds, max } = LIMITS[kind];
  try {
    const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
      p_key: `${kind}:${identifier}`,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; retry_after: number }
      | undefined;
    if (!row) throw new Error("rate_limit_hit returned no row");
    return { ok: row.allowed, retryAfter: row.allowed ? 0 : row.retry_after };
  } catch (err) {
    console.error(`[rate-limit] check failed for ${kind}, failing open`, err);
    void alertLimiterBrokenOnce();
    return { ok: true, retryAfter: 0 };
  }
}

// A broken limiter fails open by design (a DB outage also breaks book
// creation itself, so closing gains little) — but it must be VISIBLE, not
// silent. One alert per instance per day.
let limiterAlertedOn: string | null = null;
async function alertLimiterBrokenOnce(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (limiterAlertedOn === today) return;
  limiterAlertedOn = today;
  const { opsAlert } = await import("@/lib/ops-alert");
  await opsAlert(
    "Rate limiter failing open",
    "rate_limit_hit RPC calls are erroring; all rate limits are currently disabled. Check the rate_limits table / migration 0013 and database health.",
  );
}

/** Friendly, customer-facing 429 copy per route (org rule: no em dashes). */
export const RATE_LIMIT_COPY = {
  books:
    "Whoa, that's a lot of storybooks! Please wait a little while before starting another one.",
  uploads: "Too many photos too quickly, give it a minute and try again.",
  regenerate: "You've redrawn quite a few pages just now. Give it a minute.",
  retry: "The illustrators are already on it. Give it a few minutes before restarting again.",
  checkout: "Too many checkout attempts right now. Please wait a moment and try again.",
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
