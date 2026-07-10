# WFSC Launch Plan

Execution plan to take Warm Fuzzy Story Club live. Based on the full-repo audit of 2026-07-10
(site/copy, backend/commerce, pipeline/content-ops).

Work is split across two models by blast radius:

- **Fable** (workstreams F1-F5): cross-cutting changes with subtle invariants, where a wrong
  architectural call is expensive to undo, plus the final conclusive review.
- **Opus** (workstreams O1-O7): well-scoped, mostly additive tasks with explicit acceptance
  criteria, run in parallel sessions.

Branch naming: `launch/<workstream>` (e.g. `launch/f1-privacy`, `launch/o2-seo`).
Workstreams are file-disjoint by design; if you find yourself editing a file owned by another
workstream, stop and flag it instead of proceeding.

Review protocol: every workstream PR gets a `/code-review` from the OTHER model before merge.
Nothing merges unreviewed. Final sign-off is workstream F5.

---

## Phase 0 — Decisions and accounts (Thomas, before/while work starts)

These block specific workstreams; everything else can start immediately.

| # | Decision / action | Blocks |
|---|---|---|
| D1 | Legal entity details for Impressum (company name, address, register, VAT ID) and a lawyer/legal-template pass on privacy + terms + withdrawal | O1 final content (drafts can start) |
| D2 | Launch market: DACH-first (German is launch-blocking) vs US-first English (German is fast-follow). Current code defaults region to `dach`. | Scope of O7 |
| D3 | Photo/data retention window (suggestion: source photos deleted 30 days after delivery; memory text retained only while book exists) | F1 |
| D4 | Board book (€39): fix properly or cut from launch. DB enum, env var, and checkout mapping are all broken for it today. | F2 |
| D5 | ~~Create accounts~~ DONE 2026-07-10 except Turnstile: PostHog + Sentry + Resend live; Upstash DROPPED (rate limiting is Postgres-backed since migration 0013, no account needed); Cloudflare Turnstile DEFERRED (code is merged and dormant; add keys only if abuse appears — the daily budget cap bounds worst case) | — |
| D6 | Preview spend ceiling: max € per day on free preview generation before new previews queue/pause (suggestion: start at €50/day) | F3 |

---

## Fable workstreams

### F1 — Privacy and storage overhaul (GDPR) — `launch/f1-privacy`

The most sensitive change: photos of children currently live in PUBLIC buckets forever, with
no deletion path.

Scope:
1. Make `uploads`, `renders`, `print` buckets private. Serve customer-facing images via signed
   URLs (or a token-checked proxy route). Touch points: `apps/studio/src/app/api/uploads/route.ts`,
   `apps/studio/src/lib/persist.ts`, `apps/studio/src/lib/render.ts`, every component that renders
   these URLs (`flipbook.tsx`, `book-hub.tsx`, `sample-viewer.tsx`, `create-wizard.tsx` photo
   previews, email image links in `src/inngest/functions.ts` / `lib/email.ts`), and the Lulu
   submission (Lulu must be able to fetch the print PDF: use a long-lived signed URL).
   Sample-book assets may stay public (no real people's photos; synthetic cast) — decide and document.
2. Deletion path: a `DELETE` capability per book (token-authorized route + admin script) that
   removes DB rows (cascades exist) AND all storage objects (photos, sheets, spreads, renders, PDFs).
3. Retention job: scheduled function (Inngest cron) purging source photos + character sheets
   N days after `shipped`/`cancelled` per D3. Record purge in an audit column.
4. Shopify mandatory compliance webhooks: `customers/data_request`, `customers/redact`,
   `shop/redact` handlers (HMAC-verified like `webhooks/shopify/route.ts`), wired to the deletion
   path.
5. Third-party processing inventory (Replicate, Anthropic, Shopify, Lulu, Resend, Supabase,
   Vercel) written to `docs/data-processing.md` — feeds O1's privacy policy.

Acceptance: no unauthenticated URL to a customer photo works; deleting a book leaves zero
objects in storage; compliance webhooks respond 200 and actually erase; preview/review emails
still render images; a full order flows end to end with private buckets.

### F2 — Order lifecycle correctness — `launch/f2-orders`

1. Multi-book orders: replace single `shopify_orders.book_id` with a join table
   (`shopify_order_books`) or per-book processing keyed on (order id, book id); fix the
   idempotency check in `webhooks/shopify/route.ts:29-46` so every book in an order generates.
   Migration + backfill.
2. Board format (per D4): if keeping, migration extending `book_format` enum + add
   `SHOPIFY_VARIANT_BOARD` to `.env.example` + map it in `books/[token]/checkout/route.ts:40-43`;
   if cutting, remove from `FORMATS` in `book-hub.tsx`, `cart.ts`, types.
3. `onFailure` handlers for `generateFullBook`, `regenerateSpread`, `submitToPrint` in
   `src/inngest/functions.ts`: terminal statuses (`generation_failed`, `print_failed` — new enum
   values + migration), customer email, ops alert email.
4. Lulu webhook (`api/webhooks/lulu/route.ts`): wrap `timingSafeEqual` so bad signatures return
   401 not 500; add idempotency so redelivered `SHIPPED` events return 200.
5. Resolve `TODO(print)` at `webhooks/shopify/route.ts:77`: on refund/cancel after
   `submitted_to_print`, attempt Lulu job cancellation via API; alert ops if not cancellable.
6. Fix shipping-country fallback `'AT'` at `functions.ts:453`: fail loudly (ops alert, hold job)
   instead of guessing.

Acceptance: two-book cart test generates both; refund-after-print attempts Lulu cancel; killing
generation mid-book lands in a terminal failed state with an email; replayed Lulu webhook is a
no-op 200.

### F3 — Cost tracking and abuse-control spec — `launch/f3-costs`

1. Wire the existing `generation_jobs` table (`0001_core_schema.sql:145`): record every
   Replicate prediction and Claude call (stage, book_id, prediction id, cost_usd, status) from
   `packages/pipeline` callers and `functions.ts`.
2. Spend guards: per-book generation budget and a global daily preview budget (D6). When
   exceeded: previews pause with a friendly "high demand" state; paid books alert ops instead
   of silently stopping.
3. QA floor for PAID books: when spread retries exhaust below `WFSC_QA_THRESHOLD`, mark the
   spread `needs_review` and alert ops rather than silently shipping the failing image
   (previews may keep best-effort). Also fix the qa.ts doc/prompt weight mismatch (comment says
   50/30/20, prompt says 40/20/20/20).
4. Write the rate-limiting spec for O5 into this plan's PR description: limits per route,
   Turnstile placement, per-email caps.

Acceptance: dashboard query answers "what did book X cost"; exceeding the daily budget pauses
previews visibly; a paid book never auto-ships a sub-threshold image.

### F4 — i18n architecture — `launch/f4-i18n` — DONE (2026-07-10), two deviations

Scaffold only; bulk extraction/translation is O7.

1. ~~locale routing~~ **Implemented WITHOUT path routing** (next-intl request config,
   `src/i18n/`): cookie `wfsc_locale` (set via `POST /api/locale`) wins, then region
   (DACH → `de`), then `en`; `de` messages deep-merge over `en` so untranslated keys fall
   back per-key. Rationale: moving every route under `app/[locale]/` before O1-O4 run would
   guarantee conflicts with the pages those workstreams add. Switching to path-based locales
   (`/de`) is an O2 decision (better SEO/hreflang) — the message catalogs are unaffected by
   that switch. Pattern surfaces migrated: `site-footer.tsx`, `samples/page.tsx`
   (see `messages/en.json` / `de.json`).
2. Catalog translations in Supabase: **one `translations` jsonb column per table**
   (`{"de": {"title": ...}}`) instead of per-field columns — fewer columns, one overlay
   helper (`lib/i18n-content.ts`), applied in `lib/categories.ts` readers. Migration
   `0012_i18n.sql`. O7 fills these via `wfsc-admin translate` (O6).
3. Book locale: `locale` column on `books`, plumbed from wizard → `generateStory` /
   `describeCharacter` / `judgeSpread` prompts ("write in German, natural native voice, age-appropriate").
   Interior text is HTML so no image work; cover title lettering already exists as img2img
   (`scripts/letter-template-titles.mjs`) — expose it as a per-locale re-letter step.
4. Verify umlauts/ß render in all 5 font pairings in the PDF path.

Acceptance: `/de` renders the migrated surfaces in German; a test book generated with
`locale=de` produces a German story and PDF with correct diacritics; en fallback works for
untranslated catalog fields.

### F5 — Launch-readiness code review — `launch/f5-review` (LAST)

A thorough code review of our own codebase before going live, done by fresh reviewers so
nothing is judged by the context that wrote it. This is standard pre-launch QA of the
launch delta (`c369b20..HEAD`).

1. Fresh read-only reviewers over three areas: (a) order lifecycle + generation pipeline
   correctness, (b) API routes + privacy configuration (token checks, private buckets,
   rate limits, GDPR deletion path), (c) frontend/i18n/SEO/legal-page completeness.
2. Verify the tree: typecheck, lint, production build all green.
3. Smoke-test the deployed site: key routes, sitemap/robots, legal pages, 404 handling.
4. Manual end-to-end walkthrough checklist for Thomas: create a real book with the wizard,
   place a Shopify TEST-mode order (including a two-book cart), review + approve, confirm the
   Lulu SANDBOX print job, then delete the book and confirm its data is gone.
5. Output: `LAUNCH-REVIEW.md` — findings ranked by severity, what was fixed, what remains,
   go/no-go per Phase-0 decision, and a day-one ops runbook (where alerts land, how to retry
   a stuck book, how to process a refund).

---

## Opus workstreams

### O1 — Legal and trust pages — `launch/o1-legal`

1. New routes under `(site)`: `/imprint` (Impressum), `/privacy`, `/terms`, `/returns`
   (incl. 14-day EU withdrawal and its personalization exception per Art. 246a EGBGB /
   §312g Abs. 2 Nr. 1 BGB for custom-made goods — flag for lawyer), `/contact` (real page, not
   mailto only), `/about` (replace the external `warmfuzzystoryclub.com/pages/about` link in
   `(studio)/layout.tsx:53`).
2. German-first legal text where legally required (Impressum), EN+DE for the rest once F4/O7
   land; until then EN drafts with clearly marked `[LEGAL REVIEW]` placeholders for D1 facts.
3. Footer (`site-footer.tsx`): add a legal column linking all of the above. Same links in the
   `(studio)` layout footer.
4. Cookie/consent: if O3 analytics is cookieless (PostHog EU, cookieless mode), a banner may be
   avoidable; document the choice on the privacy page.
5. Wizard consent copy (`create-wizard.tsx:974-978`): link to `/privacy`, state third-party AI
   processing and the D3 retention window explicitly.

Acceptance: every page reachable from both footers; no `[LEGAL REVIEW]` markers left at merge
(or an explicit list handed to Thomas); DACH-mandatory pages exist in German.

### O2 — SEO and metadata — `launch/o2-seo`

1. `app/layout.tsx`: `metadataBase` (production domain), `openGraph` + `twitter` defaults,
   canonical URLs; per-page metadata for `(site)` routes incl. dynamic category/template pages.
2. `opengraph-image` (static brand image with logo/mascot is fine), `sitemap.ts` (static routes +
   categories/occasions/templates/samples from Supabase), `robots.ts` (disallow `/book/`,
   `/api/`, `/styleguide`).
3. Guard `/styleguide` behind an env flag or move it out of `(site)`.
4. Resolve the favicon.png / favicon.ico mismatch; add `manifest`.
5. JSON-LD `Product` on template/category pages (price range €39-69 per D4).

Acceptance: social-share debuggers render title+image for `/`, a category page, and a sample;
`curl /sitemap.xml` and `/robots.txt` are correct; `/styleguide` is not publicly reachable.

### O3 — Analytics and monitoring — `launch/o3-observability`

1. PostHog (EU host): pageviews + funnel events — wizard step entered/completed per step,
   photo upload success/fail, `createBook` submitted, preview viewed, checkout started,
   purchase (server-side from the `orders/paid` webhook), review page opened, approved.
   Server events keyed on book id, no PII in properties.
   **REQUIRED: cookieless mode** (`persistence: "memory"`) — decided 2026-07-10 so the site
   needs NO cookie banner (only strictly-necessary cookies remain: cart, locale). Trade-off:
   no cross-session visitor stitching. Revisit with a proper CMP only if ad pixels
   (Meta/Google) are ever added. Env vars are live: NEXT_PUBLIC_POSTHOG_KEY/_HOST.
2. Sentry: SDK scaffold + DSN are DONE (2026-07-10, F-track): client/server/edge init,
   request-error capture, replay (masked, 10%/100% on error), global-error boundary,
   /monitoring tunnel. O3 still owns: SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN for
   source-map upload, and instrumenting Inngest failures explicitly.
3. Ops alerting: shared helper (email via Resend to an ops address, or Slack webhook) used by
   F2/F3 failure paths — build the helper here, `lib/ops-alert.ts`.
4. `lib/email.ts:13-16`: in production, missing `RESEND_API_KEY` must fail loudly at boot
   (env assertion), not `console.warn` per send.

Acceptance: full funnel visible in PostHog from a test run; a thrown error in a wizard step
and in an Inngest function both appear in Sentry; boot fails in prod without Resend key.

### O4 — Error pages and UX polish — `launch/o4-ux`

1. `not-found.tsx`, `error.tsx`, `global-error.tsx` with site chrome and mascot; route-level
   `loading.tsx` for `(site)` dynamic pages; replace the bare `"Loading…"` on `/cart`.
2. Wizard draft persistence (`create-wizard.tsx`): serialize state (incl. uploaded photo URLs;
   uploads already persist server-side) to localStorage keyed per template/category entry;
   offer "Continue where you left off"; clear on successful submit.
3. Remove/gate visible scaffolding copy: `/artists` "coming soon" cards (either real artist
   content from Thomas or reframe the page as "Our styles" without the empty promise);
   `/account` "Accounts aren't connected yet" (hide the account nav entry until
   `SHOPIFY_CUSTOMER_ACCOUNT_*` vars are set).
4. Add missing env vars to `.env.example` (`SHOPIFY_VARIANT_BOARD` per D4,
   `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID`, `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID`), blank out the
   hardcoded `SHOPIFY_CLIENT_ID` value, and remove `https://wfsc-studio.vercel.app` fallbacks
   (`lib/email.ts:26` etc.) in favor of a required `STUDIO_URL`.
5. Accessibility pass: skip-to-content link, `role="radiogroup"` on the style picker,
   contrast-check `ink-soft` on cream.

Acceptance: bad URLs render branded 404 with nav; refresh mid-wizard restores all state;
no "coming soon / not connected" strings visible; fresh clone + `.env.example` documents every
required var.

### O5 — Rate limiting and abuse control — `launch/o5-ratelimit` (after F3 spec)

Implements F3's spec. Baseline:
1. Rate limits (Postgres-backed since 2026-07-10, `rate_limit_hit` RPC — NOT Upstash):
   `POST /api/books` 3/hour/IP + 5/day/email; `POST /api/uploads`
   30/hour/IP; regenerate endpoints 10/day/book. Friendly 429 JSON the wizard surfaces nicely.
2. Cloudflare Turnstile on the wizard finish step, verified server-side in `books/route.ts`.
3. Upload hardening: verify magic bytes not just MIME, cap pixel dimensions, strip EXIF
   (location data in kids' photos!) before storing.

Acceptance: scripted burst gets 429s; wizard shows a human message; EXIF GPS is gone from
stored uploads.

### O6 — Content-ops CLI consolidation — `launch/o6-content-cli`

1. Consolidate `scripts/*.mjs` + `regenerate-samples*.sh` into one CLI package
   (`packages/admin-cli`, `wfsc-admin <command>`): `seed`, `expand-templates`,
   `letter-titles`, `generate-samples`, `import-sample`, `finalize-samples`, `add-sample-cast`,
   `sync-shopify`, `shopify-setup`, `lulu-setup`.
2. Remove machine-specific absolute paths (`/Users/thomasragger/...`) → CLI args/env; replace
   hardcoded date cutoffs (`CUTOFF='2026-07-09'`) with flags; progress files → `.wfsc-admin/`
   in repo root (gitignored), not `/tmp`.
3. Unify the style source of truth: pipeline `BUILTIN_STYLES` (`packages/pipeline/src/styles.ts`)
   generated from `supabase/seed.sql` data (codegen script in the CLI) or fetched with a
   documented offline fallback. One authoritative source, no hand-sync.
4. `docs/content-ops.md`: the full content workflow (new template → imagery → samples →
   Shopify sync) as a runbook.

Acceptance: every old script has a CLI equivalent; no absolute paths or date constants in code;
`wfsc-admin --help` documents the workflow; old scripts deleted.

### O7 — German localization pass — `launch/o7-german` (after F4 merges)

1. Extract ALL hardcoded UI strings to `messages/en.json` following F4's pattern: `(site)/page.tsx`
   (largest surface, incl. the FAQ array), `create-wizard.tsx` (steps, roles, age bands, memory
   prompts, consent), `book-hub.tsx` (FORMATS blurbs), `category-showcase.tsx`, `sample-viewer.tsx`,
   `site-nav.tsx`, `site-footer.tsx`, `(site)/artists/page.tsx`, samples/account/cart pages,
   O1's legal-adjacent strings, O4's error pages.
2. Produce `messages/de.json`: warm, natural German (du-Form; the brand voice is cozy and
   plain-spoken, not corporate) — machine-draft then flag for Thomas's native review.
3. Translate catalog fields in Supabase (F4's jsonb columns) for all seeded templates,
   categories, occasions, styles — via a `wfsc-admin translate` command (O6) so it's repeatable.
4. Email templates (`functions.ts` / `lib/email.ts`) localized by book locale.

Acceptance: `/de` has zero English strings on every `(site)` page and the wizard; a `locale=de`
book gets German emails; Thomas signs off the German voice.

### O8 — Transactional email design + copy — `launch/o8-emails`

Redesign the four customer emails in `apps/studio/src/lib/email.ts` (previewReady,
reviewReady, printSubmitted, generationDelayed) to be genuinely on-brand and
well-written. Ops alerts (`lib/ops-alert.ts`) stay plain.

1. **Shared layout wrapper** (one function all templates use): cream background
   `#fffaf7`, white rounded card, ink `#761e0b`, coral CTA button `#ff7916`,
   logo from `${STUDIO_URL}/logo.png` (already public). Consider a mascot PNG
   (`/mascots/*.png`) as a warm accent per email.
2. **Email-client reality** (non-negotiable): table-based layout, ALL styles
   inline, no flexbox/grid, no web fonts (font stack:
   `'Quicksand','Trebuchet MS',Helvetica,Arial,sans-serif`), max width 600px,
   bulletproof button (padded table cell, not just a styled `<a>`), images with
   width attributes + alt text, works with images off. Add a preheader
   (hidden preview text) per email and pass a `text` plain-part to Resend
   alongside `html`.
3. **Copy**: match the site voice — warm, plain-spoken, second person, no
   corporate filler ("Every family has a story worth keeping" energy). Each
   email: one job, one CTA. generationDelayed stays honest (no fake ETA).
   Include the "anyone with this link can view your book" privacy note where
   a book link is present.
4. **Localization-ready**: keep all strings in one exported per-template map
   (or accept a `locale` param with an `en` table now) so O7 can add `de`
   without restructuring; templates already receive the book row — thread
   `book.locale` through.
5. **Verify**: send all four templates to OPS_ALERT_EMAIL via a small
   `wfsc-admin send-test-emails` command (admin CLI from O6) and eyeball in
   Gmail at minimum; dark-mode spot check.

Acceptance: four redesigned emails delivered to the test inbox, rendering
correctly with images on and off; strings extractable for O7; no template
regressions in the three Inngest send sites + onFailure.

### O9 — German localization: post-wizard surfaces — `launch/o9-german-studio`

Found by the F5 review: O7 covered marketing/wizard/emails, but the surfaces a
customer sees AFTER intake are hardcoded English. Extract to the existing
next-intl catalogs (pattern: any localized component, e.g. book-hub.tsx) and
write natural du-Form German for:

1. `components/editor.tsx` — the whole book-editing surface (labels, buttons,
   placeholders, aria-labels, the redraw dialog).
2. `components/status-views.tsx` — generation progress (MICRO_COPY array,
   phase lines, timeline steps, post-approval statuses).
3. `components/flipbook.tsx` — page labels (feed aria-labels), cover fallbacks,
   dedication "Love, {name}" (renders inside the book page: use the book's
   locale, not the UI locale), and the locked-page paywall teaser
   ("{n} more pages are waiting" / "Unlock your full book") — conversion copy,
   translate with care.
4. `app/(studio)/layout.tsx` — studio chrome + footer labels.
5. `app/(site)/layout.tsx` announcement bar; `app/(site)/books/page.tsx`
   hardcoded prop overrides; `app/layout.tsx` skip-link text;
   `(studio)/create/page.tsx` + `books/loading.tsx` metadata/aria strings.
6. Root `metadata` (title/description/OG) via a locale-aware `generateMetadata`
   so DACH search snippets are German.
7. Email mascot alt texts (`lib/email.ts`).

Acceptance: with the `de` locale, zero English strings anywhere in the
create → wait → review → edit → approve → read journey; `pnpm lint` and en/de
key parity clean; paywall/dedication strings reviewed by Thomas.

### O10 — German localization: showcase sample books — `launch/o10-german-samples`

O7/O9 localized the chrome and journey copy, but the six showcase sample books
(the `books.is_sample = true` gallery) still rendered their English title,
spread text and lettered covers to German visitors. O10 extends the catalog
translations pattern (0012_i18n.sql) to book content.

1. Migration `0014_sample_translations.sql`: `translations jsonb` on `books`
   and `book_spreads`, same overlay shape as the catalog tables. German cover
   images live INSIDE `translations.de` as `cover_image_url` / `mockup_image_url`
   so `localizeRow` swaps them with no site-code change.
2. Admin CLI `translate-samples`: one coherent Claude call per book (opus,
   forced tool output) translating title, dedication greeting and every spread
   together so voice, rhythm and recurring phrases stay consistent. du-Form,
   umlauts, character names kept. Idempotent on `translations.de.title`.
3. Admin CLI `letter-samples --locale de`: no title-less original survives in a
   reconstructable path (finalize-samples overwrote the cover and restyle may
   have changed the art), so it img2img-replaces the English lettering on the
   current cover with the German title, keeps everything else identical, then
   rebuilds the 3D mockup (same recipe as letter-titles). URLs land in
   `translations.de.{cover_image_url,mockup_image_url}`. Resumable via a
   `.wfsc-admin/letter-samples.de.json` progress file.
4. Readers: `lib/books.ts` selects `is_sample` + `translations` (book and
   spreads) and overlays the viewer locale via `localizeRow` before signing and
   serializing, but ONLY for sample books; customer books stay in their own
   authored language. `lib/samples.ts` overlays title plus the localized
   cover/mockup URLs on the gallery.

Acceptance: `tsc --noEmit` and `pnpm lint` clean; every sample book renders
title, greeting, all spread text and cover art in German for a `de` visitor;
customer books untouched.

---

## Sequencing

```
Week 1  Fable: F1 ────────► F2 ────────► F3
        Opus:  O1 ∥ O2 ∥ O3 ∥ O4   (4 parallel sessions, file-disjoint)

Week 2  Fable: F4 ──────► (review Opus PRs)
        Opus:  O5 (needs F3) ∥ O6 ∥ O7 (needs F4)

Week 3  Merge freeze → F5 conclusive review (fresh Fable session)
        → fix round (both models) → dress-rehearsal order → GO/NO-GO
```

Cross-review matrix: Opus PRs reviewed by Fable (`/code-review`, high effort on O5).
Fable PRs (F1-F4) reviewed by Opus. F5 is Fable-only, fresh session, reviews everything.

## How to run it

- Fable work: one session per F-workstream in this repo (`/model` Fable), pointed at this file:
  "Execute workstream F1 from LAUNCH-PLAN.md".
- Opus work: parallel Claude Code sessions with `/model opus`, one per O-workstream, each on its
  own branch/worktree: "Execute workstream O2 from LAUNCH-PLAN.md". The O1-O4 set has no file
  overlap and can genuinely run simultaneously.
- Small Opus items can alternatively be delegated from a Fable session via subagents, but
  multi-PR workstreams get their own session.
- Every workstream ends with `/verify` (drive the affected flow, not just typecheck) before
  requesting cross-review.
