-- Photorealistic product-shot render of a book's cover, generated from the
-- flat illustrated cover_image_url. Used wherever a book is shown as a
-- physical object (samples, hero); cover_image_url stays the flat art used
-- inside the actual page-turning viewer.
alter table books add column if not exists mockup_image_url text;
