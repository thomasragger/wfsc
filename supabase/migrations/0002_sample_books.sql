-- Sample books: curated example books shown publicly in the samples viewer.
alter table books add column if not exists is_sample boolean not null default false;
create index if not exists books_sample_idx on books (is_sample) where is_sample;
