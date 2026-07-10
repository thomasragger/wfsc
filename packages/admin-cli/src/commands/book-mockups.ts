import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { upload } from '../lib/images.ts';
import { uploadMockupRefs, renderMockup } from '../lib/mockups.ts';

async function run(_args: ParsedArgs): Promise<void> {
  const db = createDb();
  const replicate = createReplicate();
  await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

  const refUrls = await uploadMockupRefs(db);
  console.log('✓ style references uploaded');

  const { data: books, error } = await db
    .from('books')
    .select('id, title, cover_image_url, template_id, story_templates(category_id)')
    .eq('is_sample', true)
    .is('mockup_image_url', null);
  if (error) throw error;
  const rows = (books ?? []) as unknown as {
    id: string;
    title: string;
    cover_image_url: string | null;
    story_templates?: { category_id: string } | null;
  }[];
  console.log(`▸ generating ${rows.length} book mockups…`);

  for (const book of rows) {
    if (!book.cover_image_url) {
      console.log(`  ✗ ${book.title}: no cover_image_url`);
      continue;
    }
    try {
      const raw = await renderMockup(replicate, book.cover_image_url, refUrls);
      const category = book.story_templates?.category_id ?? book.id;
      const pub = await upload(db, 'renders', `samples/${category}/mockup.png`, raw, 'image/png');
      await db.from('books').update({ mockup_image_url: pub }).eq('id', book.id);
      console.log(`  ✓ ${book.title}`);
    } catch (err) {
      console.log(`  ✗ ${book.title}: ${String(err).slice(0, 200)}`);
    }
  }
  console.log('Book mockup generation complete.');
}

export const bookMockups: Command = {
  name: 'book-mockups',
  summary: 'Build a 3D product-shot mockup for every sample book cover missing one.',
  usage: 'book-mockups',
  run,
};
