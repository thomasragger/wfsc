# Content ops runbook

Every content-ops task runs through one CLI: `wfsc-admin`, the workspace package
`packages/admin-cli`. This replaces the old loose `scripts/*.mjs` and
`regenerate-samples*.sh`.

```bash
pnpm wfsc-admin --help            # from the repo root
# or, inside packages/admin-cli:
node bin/wfsc-admin.mjs --help
```

The CLI loads the repo-root `.env` automatically. It writes no secrets and keeps
all progress/scratch files under `.wfsc-admin/` in the repo root (gitignored),
never `/tmp`.

## Environment

| Purpose | Vars |
|---|---|
| Supabase (all catalog/sample/image commands) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Story writing + translation | `ANTHROPIC_API_KEY` |
| Image generation | `REPLICATE_API_TOKEN` |
| Shopify commands | `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `STUDIO_URL` (for `sync-shopify`) |
| Lulu setup | `LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET`, `LULU_ENV` (`sandbox`/`production`), `STUDIO_URL` |
| `seed` (psql) | `SUPABASE_DB_URL` (or `DATABASE_URL`) |
| Optional model override for `expand-templates` | `WFSC_STORY_MODEL` (default `claude-sonnet-5`) |

Machine-local asset paths (mockup reference photos, the mascot reference, the
example books used by `restyle-samples`) default to a sibling `archive/` folder
next to the repo. Override with `WFSC_ASSETS_DIR`, or per-command flags/env
(`WFSC_MOCKUP_REF_DIR`, `WFSC_MASCOT_REF`, `WFSC_BOOK_EXAMPLES_DIR`). Image
compression uses macOS `sips`.

## One-time database + store setup

```bash
# 1. Apply migrations then the seed (needs SUPABASE_DB_URL and psql).
wfsc-admin seed --migrations

# 2. Keep the offline style prompts in sync with the seed (see "Styles" below).
wfsc-admin codegen-styles

# 3. Shopify product + storefront token; prints the SHOPIFY_VARIANT_* GIDs.
wfsc-admin shopify-setup
wfsc-admin shopify-board            # optional: €39 Board book variant + product image

# 4. Lulu print webhook.
wfsc-admin lulu-setup
```

## Styles: single source of truth

`supabase/seed.sql` is the ONLY place style prompts are authored. The pipeline's
offline copy (`packages/pipeline/src/styles.ts`, `BUILTIN_STYLES`) is generated
from it, never hand-edited:

```bash
wfsc-admin codegen-styles          # regenerate styles.ts from seed.sql
wfsc-admin codegen-styles --check  # CI guard: fail if out of sync
```

After editing the styles block in `seed.sql`, re-run `codegen-styles` and commit
the regenerated `styles.ts`.

## The content workflow

### 1. New templates

```bash
wfsc-admin expand-templates                 # write ~8 templates/category via Claude + previews
wfsc-admin expand-templates --previews-only # only fill missing preview art
wfsc-admin location-templates               # the region-tagged "Adventures near you" set
```

Both are idempotent: categories already at target are skipped, and preview
generation skips templates that already have `preview_image_url`.

### 2. Imagery

```bash
wfsc-admin style-refs [styleId]   # curated per-style reference packs (one-time)
wfsc-admin letter-titles          # letter titles onto template previews + rebuild mockups (resumable)
wfsc-admin template-mockups       # 3D mockups for template previews missing one
wfsc-admin section-mascots        # the three homepage mascots
```

`letter-titles` journals progress to `.wfsc-admin/letter-template-titles.json`,
so a re-run resumes and only redoes work when the per-style colour rule changed.

### 3. Sample books

```bash
# Generate the showcase samples through the pipeline, then import each as a public sample.
wfsc-admin generate-samples
wfsc-admin generate-samples --only s-beach-treasure,s-whale-watching
wfsc-admin generate-samples --skip-import

# Import a single already-generated book directory.
wfsc-admin import-sample <generated-dir> <slug> [template-id]

# Finalize a fresh batch: letter titles onto covers, build 3D mockups.
# --since replaces the old hardcoded date cutoff; --prune removes the previous batch.
wfsc-admin finalize-samples --since 2026-07-09 [--prune]

# Give each sample a visible cast (synthetic input photo + real character sheet).
wfsc-admin add-sample-cast [--since 2026-07-09]

# Book mockups for any sample cover missing one.
wfsc-admin book-mockups

# Re-render samples in the example-book styles (resumable), then rebuild mockups.
wfsc-admin restyle-samples && wfsc-admin book-mockups
```

### 4. Shopify sync

Push the current catalog (categories, active templates, sample books with full
spreads) into Shopify metaobjects so the theme renders real data:

```bash
wfsc-admin sync-shopify            # uses STUDIO_URL for category image URLs
```

### 5. Translate (catalog i18n)

Fill the `translations` jsonb column on the catalog tables via the Anthropic API.
Used by workstream O7. Idempotent: rows already translated for the locale are
skipped unless `--force`.

```bash
wfsc-admin translate --locale de                 # all catalog tables, German
wfsc-admin translate --locale de --force         # re-translate everything
wfsc-admin translate --locale de --tables story_templates
wfsc-admin translate --locale de --dry-run       # list what would be translated, no API calls
```

Tables and translated fields:

| Table | Fields |
|---|---|
| `styles` | `name`, `description` |
| `template_categories` | `name`, `tagline` |
| `occasion_categories` | `name`, `tagline` |
| `story_templates` | `title`, `tagline`, `description` |

Written shape (base columns stay English as the fallback; readers overlay the
locale in `apps/studio/src/lib/i18n-content.ts`):

```json
{
  "de": { "title": "…", "tagline": "…", "description": "…" }
}
```

Existing locales are preserved on write; only the target locale's object is
merged. Default model is `claude-opus-4-8` (override with `--model`).
