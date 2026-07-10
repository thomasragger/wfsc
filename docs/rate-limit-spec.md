# Rate limiting & abuse control — spec for workstream O5

Written by F3. Application-level guards (daily preview budget, per-book regen
cap) already exist; this spec covers the per-client limits O5 implements.

## Infrastructure

- Postgres-backed (decision 2026-07-10: no Upstash, keep the service count
  down): `rate_limits` table + atomic `rate_limit_hit` RPC, fixed window
  (migration `0013_rate_limits.sql`). Adequate at our request rates; revisit
  Redis only if abuse ever makes DB load visible.
- Enforce in each route handler (not middleware) so limits can key on
  body/email as well as IP. IP from `x-forwarded-for` first hop; treat
  missing IP as one shared bucket, never as unlimited.
- Response on limit: HTTP 429, JSON `{ error: "<friendly copy>" }` — the
  existing client `request()` helper surfaces `error` verbatim, so the copy
  must be customer-friendly, not technical.

## Limits

| Route | Key | Limit | Rationale |
|---|---|---|---|
| `POST /api/books` | IP | 3 / hour | each call triggers paid preview generation |
| `POST /api/books` | email (normalized, lowercase) | 5 / day | stops single-IP rotation |
| `POST /api/uploads` | IP | 30 / hour | 10 MB each; wizard needs at most 12 (4 people × 3) |
| `POST .../spreads/[id]/regenerate` | book token | 10 / day | complements the lifetime `WFSC_MAX_REGENS_PER_BOOK` (15) |
| `POST .../checkout`, `POST /api/cart` | IP | 20 / hour | Shopify mutation cost |
| `POST .../retry` | book token | 5 / hour | each retry re-runs the preview pipeline |

## Turnstile

- Cloudflare Turnstile widget on the wizard's Finish step (the step that
  calls `createBook`); token passed in the `POST /api/books` body and
  verified server-side (`https://challenges.cloudflare.com/turnstile/v0/siteverify`).
- Env: `TURNSTILE_SITE_KEY` (public), `TURNSTILE_SECRET_KEY`. When unset
  (local dev), skip verification with a `console.warn`.

## Upload hardening (same workstream)

- Verify magic bytes (JPEG/PNG/WebP/HEIC), not just the `type` header.
- Re-encode or strip EXIF before storing — customer photos of children may
  carry GPS coordinates (flagged in docs/data-processing.md).
- Cap pixel dimensions (e.g. 8000×8000) to bound downstream model input.

## Copy for 429s

- books: "Whoa, that's a lot of storybooks! Please wait a little while before
  starting another one."
- uploads: "Too many photos too quickly — give it a minute and try again."
- regenerate: "You've redrawn quite a few pages just now — give it a minute."
