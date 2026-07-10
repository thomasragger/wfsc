-- The dedication page can name who the book is from ("Love, Grandma").
-- Optional, set from the create wizard's personal-note step or sample configs.
alter table books add column if not exists greeting_from text;
