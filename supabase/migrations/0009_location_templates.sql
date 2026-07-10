-- Location-based story templates: a "places you love" browse axis whose
-- templates are set in real, recognizable spots. Each is tagged with a region
-- so the site can auto-show DACH spots to DACH visitors and US spots to US ones.
alter table story_templates add column if not exists region text; -- 'dach' | 'us' | null(any)

insert into template_categories (id, name, tagline, sort_order)
values ('places', 'Adventures near you', 'Set your story in a place you both love.', 100)
on conflict (id) do update set name = excluded.name, tagline = excluded.tagline;
