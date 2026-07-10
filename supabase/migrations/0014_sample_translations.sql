-- O10 sample localization: translate the showcase sample books per locale.
-- Same overlay shape as 0012_i18n.sql: { "<locale>": { "<field>": "<value>" } }.
-- Base columns stay English (the fallback); readers overlay the viewer locale
-- for is_sample books only (apps/studio/src/lib/i18n-content.ts). German cover
-- images live inside translations.<locale> as cover_image_url / mockup_image_url
-- so localizeRow swaps them with no site-code change.
alter table books        add column if not exists translations jsonb not null default '{}';
alter table book_spreads add column if not exists translations jsonb not null default '{}';
