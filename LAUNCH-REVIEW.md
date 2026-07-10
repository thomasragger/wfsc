# Launch-readiness review — 2026-07-10

F5 per LAUNCH-PLAN.md. Three fresh reviewers (order lifecycle + pipeline; API +
privacy configuration; frontend + i18n + SEO) over the launch delta
(`c369b20..HEAD`), plus production smoke tests. Tree at review time: typecheck,
lint, and production build all green; all O-workstreams merged.

## Verdict: NO-GO until the two items below; everything else is fixed or scheduled.

### Launch blockers (only you can clear these)

1. **Legal placeholders (D1).** The Impressum and the other legal pages render
   literal `[LEGAL REVIEW]` markers where the company name, address, register
   number, VAT ID, and managing director belong. A DACH-facing shop without a
   real Impressum is an Abmahnung magnet. Fill in the D1 facts and have a
   lawyer (or a trusted template service) pass over privacy/terms/returns.
2. **Domain.** Canonicals, robots, and the sitemap all declare
   `https://warmfuzzystoryclub.com`, which is not yet pointed at this app.
   Before marketing spend: add the domain to the Vercel project, update DNS,
   and keep `NEXT_PUBLIC_SITE_URL`/`STUDIO_URL` in sync.

### Found by review and FIXED (commit `launch-review` batch)

| Severity | Finding | Fix |
|---|---|---|
| HIGH | Paid orders lost email/order-id/format linkage when the book wasn't `preview_ready` at webhook time (customer gets no emails; print submission fails) | Linkage now persists unconditionally; only the status transition is guarded. Add-to-cart now requires `preview_ready` (same gate as checkout) |
| HIGH | ANY refund (incl. partial goodwill refunds) cancelled the book and the Lulu print job | `refunds/create` now checks the order's financial status via the Admin API; only fully-refunded orders cancel, partials alert ops |
| HIGH | Book access tokens (bearer credentials) leaked to PostHog and Sentry in page URLs | Token path segments redacted in the PostHog pageview and via Sentry beforeSend/beforeSendTransaction/breadcrumb scrubbing (`lib/redact.ts`) |
| HIGH | `retry`, `checkout`, and `cart` routes had no rate limit (retry re-runs the paid preview pipeline unbounded) | New `retry-book` (5/h), `checkout-ip` and `cart-ip` (20/h) limits wired in |
| HIGH | IP rate limiting keyed on the client-forgeable leftmost `x-forwarded-for` hop | Now trusts Vercel's `x-real-ip`, falling back to the rightmost XFF hop |
| MEDIUM | A Supabase write failure after the Lulu print-job call could re-run the step and physically print the book twice | Lulu call isolated in its own memoized Inngest step |
| MEDIUM | Account page and sample gallery served unsigned private-bucket cover URLs (broken images) | Signed via `signUrls` in both |
| MEDIUM | Upload path had no decode-size cap (10 MB PNG can decompress to ~800 MB raw; OOM lever) | 80 MP `limitInputPixels` + header-level dimension check before decode |
| MEDIUM | Titleless German books got English subjects ("Your storybook"); emails always `lang="en"` | Localized fallback title + `lang` threaded through the layout |
| MEDIUM | Skip-link pointed at a nonexistent target on 404/error pages | `id="main-content"` added |
| LOW | JSON-LD not escaped against `</script>` breakout (foot-gun if ever fed customer text) | `<` escaping in the serializer |
| LOW | Rate limiter failed open silently on DB errors | Fails open by design, but now ops-alerts once per instance/day |
| LOW | Legal/about/contact pages missing from sitemap | Added |
| LOW | 2 lint errors, 2 warnings | Fixed (justified suppressions where the pattern was correct) |

### Scheduled as workstream O9 (Opus) — the one big remainder

The German pass (O7) covered marketing pages, wizard, and emails, but the
POST-wIZARD surfaces are hardcoded English: `editor.tsx`, `status-views.tsx`,
`flipbook.tsx` (including the conversion-critical paywall teaser and the
"Love, {name}" line rendered inside the book page), `(studio)/layout.tsx`,
the `(site)` announcement bar, and `books/page.tsx` prop overrides. For a
DACH launch this is the German customer's whole experience after intake.
See LAUNCH-PLAN.md O9.

### Accepted risks (explicit decisions, revisit post-launch)

- **Turnstile deferred** (D5): human-verification on book creation is dormant
  until Cloudflare keys are added. Backstops: per-IP/email rate limits (now
  spoof-resistant) + $50/day preview budget.
- **Rate limiter fails open** on DB errors (alerted): a Postgres outage also
  breaks book creation itself, so closing gains little.
- **Sentry replay** may capture navigation URLs pre-scrub in edge cases;
  replay masks all text/media by default, and tokens are scrubbed from
  events/breadcrumbs.
- **`/book/[token]` has no noindex meta** (robots.txt disallow covers it).
- **generateFullBook on a book without a story** (paid mid-preview edge case)
  fails to `generation_failed` + ops alert rather than auto-recovering —
  acceptable at launch volume; the add-to-cart gate makes it near-impossible.

### Verified clean by reviewers (highlights)

Webhook HMAC verification and idempotency; book-token authorization (no IDOR);
signed-URL discipline end to end incl. the PDF/print path; GDPR deletion
covers every asset location; sitemap leaks no customer tokens; no secrets in
the repo; PostHog is cookieless with no PII in properties; en/de message
catalogs have full key parity; wizard draft persistence is sound; email
templates match all call sites with correct locale threading.

## Manual walkthrough before flipping the switch (Thomas)

1. Create a real book via the wizard (German locale) with real photos.
2. Confirm preview email arrives; add to cart; pay with Shopify **test mode**
   (Bogus Gateway) — also test a two-book cart.
3. Confirm full generation completes and the review email arrives; edit a
   page; approve.
4. Confirm the Lulu **sandbox** print job appears; simulate/await SHIPPED;
   confirm Shopify fulfillment + tracking.
5. Issue a small PARTIAL refund on a test order → book must NOT cancel
   (ops alert instead). Cancel an order fully → book cancels.
6. Delete a test book via the API and confirm storage + rows are gone.

## Day-one ops runbook

- **Alerts** land at ragmaen@gmail.com (OPS_ALERT_EMAIL). Errors in Sentry;
  funnel in PostHog (EU).
- **Stuck preview:** customer-visible retry button, or re-send
  `book/preview.requested` with the book id from Inngest.
- **`generation_failed`:** fix cause (Sentry), set status back to
  `purchased`, re-send `book/purchased`.
- **`print_failed`:** fix cause (often address), set status to `approved`,
  re-send `book/approved`.
- **Refund request:** refund in Shopify. Full refund auto-cancels the book
  and attempts Lulu cancellation; partial refunds only alert.
- **GDPR erasure request:** `DELETE /api/books/{token}`, or for an email
  without a token: look up books by email and use `deleteBookData` (see
  `wfsc-admin`); Shopify `customers/redact` handles store-initiated ones.
- **Spend:** `generation_jobs` table has per-book estimated costs;
  `PREVIEW_DAILY_BUDGET_USD` pauses free previews at the cap.
