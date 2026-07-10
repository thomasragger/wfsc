-- F4 i18n: catalog translations + per-book language.

-- Per-table translations: { "<locale>": { "<field>": "<value>", ... } }.
-- Base columns stay English (the fallback); readers overlay the locale's
-- fields when present (apps/studio/src/lib/i18n-content.ts).
alter table styles              add column if not exists translations jsonb not null default '{}';
alter table template_categories add column if not exists translations jsonb not null default '{}';
alter table occasion_categories add column if not exists translations jsonb not null default '{}';
alter table story_templates     add column if not exists translations jsonb not null default '{}';

-- Language the story is written (and the book printed) in.
alter table books add column if not exists locale text not null default 'en';
