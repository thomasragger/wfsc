# WFSC End-to-End Launch Gap Audit — 2026-07-11

Conclusive read-only audit of Warm Fuzzy Story Club before going live. Verified
programmatically against production where possible (Vercel API/CLI, Supabase REST,
Lulu sandbox auth, Resend API, live `wfsc-studio.vercel.app` HTTP) and otherwise
from code. No source files were modified.

## Go / No-Go

**NO-GO** — but the remaining work is small and almost entirely in Thomas's hands, not
in code. The codebase is in strong shape: typecheck is clean, en/de key parity is
perfect, the full purchase/print/GDPR pipeline is implemented correctly (HMAC-verified
idempotent webhooks, terminal failure states with ops alerts, private buckets + signed
URLs, deletion route + retention cron), and the German localization is complete across
marketing, wizard, and post-wizard surfaces. The blockers are all operational: the legal
facts are still `[LEGAL REVIEW]` placeholders, the real domain is not connected (so the
whole site is currently noindexed on purpose), and — most importantly — **not one order
has ever run end to end.** All 8 real books in the database are stuck at `preview_ready`;
`generation_jobs` has zero rows; Lulu is in sandbox. The entire post-purchase half of the
product has no runtime evidence at all. A dress-rehearsal test order is mandatory before
launch, and several dashboard registrations (Shopify webhooks, customer-account callback,
Resend domain) can only be confirmed by Thomas.

## Gaps by severity

| # | Sev | Owner | Finding & evidence | Action |
|---|-----|-------|--------------------|--------|
| 1 | BLOCKER | USER | **Legal facts missing.** `imprint/page.tsx` renders 8 visible `[LEGAL REVIEW]` markers (company name/Rechtsform, street, city/country, managing director, phone, register court, register number, VAT ID, editorial-responsible). `privacy`/`terms`/`returns`/`contact` also carry `[LEGAL REVIEW]` blocks. A DACH shop without a real Impressum is an Abmahnung magnet. | Supply D1 facts; lawyer/template-service pass on privacy/terms/returns (incl. the §312g custom-goods withdrawal exception). Remove all markers. |
| 2 | BLOCKER | USER | **Domain not connected.** `vercel domains ls` = 0 domains. `NEXT_PUBLIC_SITE_URL` absent from prod env → `isLaunched()=false` → live `robots.txt` = `Disallow: /` and every page emits `noindex,nofollow` (both verified live). Canonicals/OG/sitemap/emails use `wfsc-studio.vercel.app`. Correct staging behavior, but the switch is not flipped. | Add `warmfuzzystoryclub.com` in Vercel, update DNS, set `NEXT_PUBLIC_SITE_URL` + `STUDIO_URL` to it, redeploy. Then re-verify robots/canonicals/emails. |
| 3 | BLOCKER | USER | **No end-to-end order ever run.** All 8 non-sample books are `preview_ready`/`preview_generating` (newest 2026-07-08); `shopify_orders` shows no progression; `generation_jobs` = 0 rows; `LULU_ENV=sandbox`. The webhook → `generateFullBook` → review email → approve → Lulu → shipping/fulfillment path has zero runtime evidence. | Run the LAUNCH-REVIEW walkthrough: create a book, Shopify **test-mode** order (incl. two-book cart), confirm review email, approve, confirm Lulu **sandbox** job + SHIPPED, then delete and confirm data gone. Verify a partial refund does NOT cancel. |
| 4 | REQUIRED | USER | **Shopify webhooks registration unverified.** The route handles `orders/paid`, `orders/cancelled`, `refunds/create`, `customers/data_request`, `customers/redact`, `shop/redact`, but registration is a manual dashboard step — no `webhookSubscriptionCreate` in code or `admin-cli/shopify-setup.ts`. Cannot confirm via API (no admin token locally; dashboard config). | Confirm all 6 topics are registered in the Shopify app, pointing at `https://<launch-domain>/api/webhooks/shopify`. Update URLs when the domain changes. |
| 5 | REQUIRED | USER | **Resend sender domain unverified.** `EMAIL_FROM` defaults to `hello@warmfuzzystoryclub.com` (not set in prod, so the default is used). The prod key is send-restricted so I couldn't query `/domains`; if `warmfuzzystoryclub.com` isn't verified in Resend, every send 403s (fails silently, ops-alerted, but customer gets nothing). | Verify the domain at resend.com/domains (SPF/DKIM). Confirm a real send lands during the dress rehearsal. |
| 6 | REQUIRED | USER | **Customer-account callback URI.** Both `SHOPIFY_CUSTOMER_ACCOUNT_*` vars are set in prod, so the account link is now **live** in the nav. Login route redirects to `${origin}/account/callback`. If that URI isn't registered in Shopify's Customer Account API settings, login fails. | Register `https://<launch-domain>/account/callback` (and the vercel.app one if used) in Shopify, or hide the account entry until verified. |
| 7 | REQUIRED | USER | **Lulu still sandbox.** `LULU_ENV=sandbox` in prod. Sandbox client-credentials auth verified working, but real fulfillment needs `LULU_ENV=production`, production keys, and a funded Lulu account. | After the sandbox dress rehearsal passes, switch to production credentials and confirm one real/staged job. |
| 8 | REQUIRED | CODE→USER | **Watercolor has no sample book.** Of 5 active styles, watercolor is the only one with 0 sample books (`books.is_sample`: flat-vector 2, crayon 2, riso-print 1, mid-century 1, watercolor 0). Its style-picker card shows no sample. | Run `wfsc-admin generate-samples` for a watercolor book (+ translate-samples/letter-samples for de). Needs generation spend, so Thomas-triggered. |
| 9 | SOON | USER | **Sentry source maps not uploading.** `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` absent from prod env → errors capture but with minified stack traces. | Add the three vars in Vercel (CI/build scope). |
| 10 | SOON | USER | **Cost tracking unverified.** `recordGenerationJob` is wired at story/character/spread/upscale stages and the `PREVIEW_DAILY_BUDGET_USD=50` guard exists, but `generation_jobs` is empty — never exercised (existing books predate the wiring). | Confirm rows appear and the "what did book X cost" query works during the dress rehearsal. |
| 11 | SOON | USER | **Two Vercel projects + stale link.** `wfsc-studio` (active, holds all env + the `wfsc-studio.vercel.app` alias) and `wfsc-studio-legacy` both exist; local `.vercel/project.json` still has `projectName:"studio"` (id is correct). Risk: a stray `vercel deploy` targets the wrong, env-less project. | Confirm the domain and future deploys target `wfsc-studio`; delete/rename the legacy project. |
| 12 | NICE | — | **Turnstile deferred** (accepted, D5). Code merged and dormant; `TURNSTILE_*` keys unset. Backstopped by rate limits + daily budget. | Add keys only if abuse appears. |
| 13 | NICE | CODE | **JSON-LD only on category/template pages**, not the homepage. `/de/for/dads` has 2 LD blocks; homepage has 0. | Optional: add Organization/WebSite JSON-LD to the homepage. |

## Verified working (confirmed good)

- **Quality gates:** `tsc --noEmit` clean for `apps/studio` AND `packages/admin-cli` (the 2 prior `letter-samples.ts` errors are fixed). 22 lint-disables, all benign (`@next/next/no-img-element` for signed/email images). No TODO/FIXME in the purchase path.
- **i18n:** en/de key parity perfect — 588 en keys, 0 missing in de (4 harmless extras). O9 post-wizard German landed (`editor.tsx`, `status-views.tsx`, `flipbook.tsx` all use translation hooks).
- **Content translation:** 66 templates all lettered EN+DE (`mockup_image_url` + `translations.de.mockup_image_url`); 6 sample books all `approved` with de translations AND de cover/mockup art; all 7 styles + all template categories carry `de`.
- **SEO:** hreflang `en`/`de`/`x-default` in both the page head and `sitemap.xml`; `og-image` 200; JSON-LD Product on category pages; `/styleguide` 404-guarded in prod; staging correctly `noindex` + disallow-all (will flip with `NEXT_PUBLIC_SITE_URL`).
- **Commerce:** prices consistent 39/49/69; board format fully wired (enum, `SHOPIFY_VARIANT_BOARD` set in prod, checkout maps all three formats); checkout gated on `preview_ready`.
- **Order/print pipeline (code):** webhook HMAC-verified + idempotent; order/email/format linkage persisted unconditionally; `onFailure` handlers on all 3 Inngest functions with `generation_failed`/`print_failed` terminal states + ops alerts; missing-shipping-country holds the job (no `AT` guess); Lulu call isolated in its own step; partial-refund guard (only full refunds cancel).
- **GDPR:** `DELETE /api/books/[token]` route; daily retention purge cron (`0 4 * * *`, `RETENTION_DAYS`); all 3 Shopify compliance topics handled; private buckets + signed URLs; PostHog cookieless (no banner needed).
- **Infra:** prod env has every runtime-critical var (Supabase, Anthropic, Replicate, all Shopify, all Lulu, Resend, `STUDIO_URL`, PostHog, Sentry DSN, ops/cost controls, Inngest keys). Lulu sandbox auth returns a token. Inngest endpoint deployed (`/api/inngest` 401 as expected). Production deployment Ready.
