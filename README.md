# Warm Fuzzy Story Club

Turn family memories into printed, illustrated children's storybooks: upload photos, tell the story, pick an illustration style, preview, buy, fine-tune, print.

## Architecture

- **Shopify store** (existing theme): marketing, product page, checkout, order admin
- **Studio** (`apps/studio`, Next.js on Vercel): builder wizard, preview flipbook, book editor, Shopify/Lulu webhooks, Inngest job functions
- **Pipeline** (`packages/pipeline`): Claude story writer → character sheets (nano-banana-pro) → spreads (seedream-4.5) → vision QA → upscale (recraft) on Replicate
- **Book engine** (`packages/book-engine`): shared page layouts, fonts, print geometry, HTML → PDF renderer (Chromium + pdf-lib)
- **Supabase**: Postgres (books, spreads, people, orders, print jobs) + Storage (photos, renders, PDFs)
- **Lulu Print API**: 8.5×8.5in casewrap, EU+US auto-routed production, tracking → Shopify fulfillment

Flow: intake → free preview (character sheets + cover + 2 spreads) → Shopify checkout (`cartCreate` + hidden `_book_id`) → `orders/paid` webhook → full generation → email review link → customer edits greeting/fonts/layout and approves → PDF preflight → Lulu print job → `SHIPPED` webhook → Shopify fulfillment with tracking.

## Development

```bash
pnpm install
cp .env.example .env       # fill in keys
pnpm dev                   # studio on :3000
npx inngest-cli@latest dev # local Inngest dev server
```

Database: apply `supabase/migrations/` then `supabase/seed.sql` to your Supabase project (`supabase db push` or SQL editor). The seed can also be applied with `pnpm wfsc-admin seed` (needs `SUPABASE_DB_URL`).

### Content ops

All content-ops tasks (seeding, template expansion, cover imagery, sample books, Shopify/Lulu setup, catalog translation) run through one CLI:

```bash
pnpm wfsc-admin --help
```

The full workflow (new template to imagery to samples to Shopify sync to translate) is documented in `docs/content-ops.md`.

### Pipeline CLI harness

Iterate on book quality without the app:

```bash
pnpm generate-book packages/pipeline/test-fixtures/example-config.json
```

Outputs `story.json`, character sheets, spread images, and a print-ready interior PDF.
