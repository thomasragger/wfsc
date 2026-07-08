-- Age-adaptive books + occasion/age taxonomy for templates
alter table books add column if not exists target_age int;
alter table story_templates add column if not exists age_min int not null default 2;
alter table story_templates add column if not exists age_max int not null default 6;
alter table story_templates add column if not exists occasions text[] not null default '{}';
alter table story_templates add column if not exists preview_image_url text;

create table if not exists occasion_categories (
  id text primary key,
  name text not null,
  tagline text,
  sort_order int not null default 0
);
alter table occasion_categories enable row level security;
drop policy if exists "public read occasions" on occasion_categories;
create policy "public read occasions" on occasion_categories for select using (true);

insert into occasion_categories (id, name, tagline, sort_order) values
('birthday', 'Birthdays', 'A story as unforgettable as the day itself.', 1),
('new-baby', 'New baby', 'Welcome the newest family member.', 2),
('special-trips', 'Special trips', 'The journeys you never want to forget.', 3),
('first-times', 'First times', 'First steps, first days, first everything.', 4),
('everyday-magic', 'Everyday magic', 'Ordinary days that felt extraordinary.', 5),
('holidays', 'Holidays & seasons', 'Christmas mornings, summer nights, autumn walks.', 6),
('grandparents-day', 'For grandparents', 'Their wisdom and warmth, kept forever.', 7),
('graduation', 'Milestones', 'School days, achievements, growing up.', 8)
on conflict (id) do update set name = excluded.name, tagline = excluded.tagline, sort_order = excluded.sort_order;
