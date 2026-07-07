-- WFSC core schema
-- Books are accessed via unguessable access tokens (no customer accounts in v1).
-- All writes go through the Studio server (service role); public read only for catalog tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Catalog: illustration styles
-- ---------------------------------------------------------------------------
create table styles (
  id            text primary key,                 -- slug, e.g. 'flat-vector'
  name          text not null,
  description   text,
  -- Locked style descriptor paragraph appended verbatim to every image prompt.
  style_prompt  text not null,
  -- 3-5 curated reference images passed to the image model with every call.
  reference_image_urls text[] not null default '{}',
  preview_image_url    text,
  sort_order    int not null default 0,
  is_active     boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Catalog: story template categories + templates ("inspiration" launchable
-- into the builder via create.<domain>/?template=<id>)
-- ---------------------------------------------------------------------------
create table template_categories (
  id             text primary key,                -- slug, e.g. 'grandparents'
  name           text not null,
  tagline        text,
  hero_image_url text,
  sort_order     int not null default 0
);

create table story_templates (
  id                 text primary key,            -- slug, e.g. 'day-at-the-zoo'
  category_id        text not null references template_categories(id),
  title              text not null,
  tagline            text,
  description        text,
  suggested_style_id text references styles(id),
  -- Ordered narrative beats; Claude expands these into the 14 spreads.
  story_beats        jsonb not null default '[]',
  -- Extra guidance for the story writer (tone, must-include moments).
  prompt_scaffold    text,
  cover_concept      text,
  example_image_url  text,
  sort_order         int not null default 0,
  is_active          boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Books
-- ---------------------------------------------------------------------------
create type book_status as enum (
  'draft',              -- intake in progress
  'preview_generating',
  'preview_ready',      -- character sheets + cover + sample spreads done
  'purchased',          -- orders/paid received
  'generating',         -- full book generating
  'ready_for_review',   -- customer editing/approving via email link
  'approved',           -- customer approved final book
  'submitted_to_print', -- sent to Lulu
  'shipped',
  'cancelled'
);

create type book_format as enum ('softcover', 'hardcover');

create table books (
  id            uuid primary key default gen_random_uuid(),
  -- Tokenized access: builder sessions and email approval links use this.
  access_token  text not null unique default encode(gen_random_bytes(24), 'hex'),
  email         text,
  status        book_status not null default 'draft',
  title         text,
  memory_text   text,                             -- the customer's memory, in their words
  template_id   text references story_templates(id),
  style_id      text references styles(id),
  format        book_format,
  font_pairing  text not null default 'storybook',
  greeting      text,                             -- dedication page text
  page_count    int not null default 32,
  -- Structured story from Claude: { title, spreads: [{ text, illustration_prompt, copy_space }] }
  story         jsonb,
  cover_image_url        text,
  cover_print_image_url  text,
  pdf_interior_url       text,
  pdf_cover_url          text,
  shopify_order_id       bigint,
  shopify_order_number   text,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index books_status_idx on books (status);
create index books_shopify_order_idx on books (shopify_order_id);

-- ---------------------------------------------------------------------------
-- People in a book (each gets a character sheet)
-- ---------------------------------------------------------------------------
create table book_people (
  id                    uuid primary key default gen_random_uuid(),
  book_id               uuid not null references books(id) on delete cascade,
  name                  text not null,             -- 'Phoebe'
  role                  text,                      -- 'child', 'grandpa', ...
  photo_urls            text[] not null default '{}',
  character_sheet_url   text,
  -- Appearance lock, used verbatim in every spread prompt ("MIA, a 5-year-old
  -- girl with curly red hair, yellow dungarees").
  character_description text,
  approved              boolean not null default false,
  sort_order            int not null default 0
);

create index book_people_book_idx on book_people (book_id);

-- ---------------------------------------------------------------------------
-- Spreads (position 0 = cover; 1..N = interior spreads; greeting handled by kind)
-- ---------------------------------------------------------------------------
create table book_spreads (
  id                  uuid primary key default gen_random_uuid(),
  book_id             uuid not null references books(id) on delete cascade,
  position            int not null,
  kind                text not null default 'story',  -- 'cover' | 'greeting' | 'story'
  text                text,
  illustration_prompt text,
  copy_space          text,                       -- e.g. 'quiet sky area, upper third'
  layout              text not null default 'text-left', -- see book-engine LAYOUTS
  image_url           text,                       -- working resolution
  print_image_url     text,                       -- upscaled to 300dpi + bleed
  qa_score            int,
  qa_notes            text,
  regen_note          text,                       -- customer's adjustment note for regeneration
  updated_at          timestamptz not null default now(),
  unique (book_id, position)
);

create index book_spreads_book_idx on book_spreads (book_id);

-- ---------------------------------------------------------------------------
-- Pipeline bookkeeping
-- ---------------------------------------------------------------------------
create table generation_jobs (
  id                      uuid primary key default gen_random_uuid(),
  book_id                 uuid not null references books(id) on delete cascade,
  stage                   text not null,          -- 'story' | 'character_sheet' | 'spread' | 'qa' | 'upscale' | 'compose'
  subject_id              uuid,                   -- book_people.id or book_spreads.id when applicable
  status                  text not null default 'running', -- 'running' | 'succeeded' | 'failed'
  error                   text,
  replicate_prediction_id text,
  cost_usd                numeric(8,4),
  created_at              timestamptz not null default now(),
  finished_at             timestamptz
);

create index generation_jobs_book_idx on generation_jobs (book_id);

-- ---------------------------------------------------------------------------
-- Shopify + print integration
-- ---------------------------------------------------------------------------
create table shopify_orders (
  id               bigint primary key,            -- Shopify order id
  book_id          uuid references books(id),
  order_number     text,
  financial_status text,
  -- Webhook idempotency: X-Shopify-Webhook-Id values already processed.
  processed_webhook_ids text[] not null default '{}',
  shipping_address jsonb,
  raw              jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table print_jobs (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null references books(id),
  provider        text not null default 'lulu',
  provider_job_id text,
  status          text not null default 'created',
  tracking        jsonb,                          -- [{ carrier, number, url }]
  cost            jsonb,                          -- provider cost breakdown
  raw             jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index print_jobs_book_idx on print_jobs (book_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger books_updated_at before update on books
  for each row execute function set_updated_at();
create trigger book_spreads_updated_at before update on book_spreads
  for each row execute function set_updated_at();
create trigger shopify_orders_updated_at before update on shopify_orders
  for each row execute function set_updated_at();
create trigger print_jobs_updated_at before update on print_jobs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: catalog is public-readable; everything else server-only (service role)
-- ---------------------------------------------------------------------------
alter table styles              enable row level security;
alter table template_categories enable row level security;
alter table story_templates     enable row level security;
alter table books               enable row level security;
alter table book_people         enable row level security;
alter table book_spreads        enable row level security;
alter table generation_jobs     enable row level security;
alter table shopify_orders      enable row level security;
alter table print_jobs          enable row level security;

create policy "public read styles" on styles
  for select using (is_active);
create policy "public read categories" on template_categories
  for select using (true);
create policy "public read templates" on story_templates
  for select using (is_active);
-- books/book_* intentionally have no anon policies: the Studio server uses the
-- service role and enforces access via books.access_token.
