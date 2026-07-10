-- F2 order lifecycle correctness.

-- Board book was sold in the UI but missing from the enum (inserts failed).
alter type book_format add value if not exists 'board';

-- Terminal failure states so paid orders never strand silently in
-- 'generating' / 'approved' when retries exhaust.
alter type book_status add value if not exists 'generation_failed';
alter type book_status add value if not exists 'print_failed';

-- An order can contain several books; shopify_orders previously stored a
-- single book_id, so all but the first book in a cart were silently dropped.
-- This join table is also the per-book processing claim: the orders/paid
-- handler only triggers generation when its insert actually lands.
create table if not exists shopify_order_books (
  order_id   bigint not null references shopify_orders(id) on delete cascade,
  book_id    uuid   not null references books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (order_id, book_id)
);

alter table shopify_order_books enable row level security;
-- no anon policies: server-only, same as the other order tables
