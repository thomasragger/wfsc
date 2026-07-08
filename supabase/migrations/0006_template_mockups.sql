-- Photographed 3D book mockup rendered from a template's flat preview, shown
-- on hover of the "Start from a story" tiles.
alter table story_templates add column if not exists mockup_image_url text;
