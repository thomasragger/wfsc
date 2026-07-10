-- When a book's cover image already has its title illustrated onto it (samples,
-- and later customer covers), the viewer should not also print an HTML title
-- underneath. Flag it so the flipbook cover page can suppress the redundant text.
alter table books add column if not exists cover_has_title boolean not null default false;
