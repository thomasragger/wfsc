-- F1 privacy: customer data moves to private buckets.
--   uploads      -> private (customer photos, usually of children)
--   book-assets  -> private, new (generated customer assets: sheets, spreads, print PDFs)
--   print        -> private (legacy PDF bucket; new PDFs go to book-assets)
-- `renders` stays public and holds catalog/sample content only.
insert into storage.buckets (id, name, public)
values
  ('uploads', 'uploads', false),
  ('book-assets', 'book-assets', false),
  ('print', 'print', false)
on conflict (id) do update set public = excluded.public;

-- Retention bookkeeping: set when source photos + character sheets have been
-- purged by the retention job (RETENTION_DAYS after shipped/cancelled).
alter table books add column if not exists assets_purged_at timestamptz;
