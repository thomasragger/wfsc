import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { createDb, createReplicate } from '../lib/clients.ts';
import { toJpeg, upload } from '../lib/images.ts';
import { uploadMockupRefs, renderMockup } from '../lib/mockups.ts';

async function run(_args: ParsedArgs): Promise<void> {
  const db = createDb();
  const replicate = createReplicate();
  await db.storage.createBucket('renders', { public: true }).catch(() => undefined);

  const refUrls = await uploadMockupRefs(db);
  console.log('✓ style refs ready');

  const { data: templates, error } = await db
    .from('story_templates')
    .select('id, title, preview_image_url')
    .not('preview_image_url', 'is', null)
    .is('mockup_image_url', null);
  if (error) throw error;
  const rows = (templates ?? []) as { id: string; title: string; preview_image_url: string }[];
  console.log(`▸ generating ${rows.length} template mockups…`);

  for (const t of rows) {
    try {
      const raw = await renderMockup(replicate, t.preview_image_url, refUrls);
      const jpeg = await toJpeg(raw, `tm-${t.id}`, 800, 80);
      const pub = await upload(db, 'renders', `template-mockups/${t.id}.jpg`, jpeg, 'image/jpeg');
      await db.from('story_templates').update({ mockup_image_url: pub }).eq('id', t.id);
      console.log(`  ✓ ${t.id}: ${(jpeg.length / 1024).toFixed(0)}KB`);
    } catch (err) {
      console.log(`  ✗ ${t.id}: ${String(err).slice(0, 120)}`);
    }
  }
  console.log('Template mockups complete.');
}

export const templateMockups: Command = {
  name: 'template-mockups',
  summary: 'Build a 3D book mockup for every template preview missing one (resumable).',
  usage: 'template-mockups',
  run,
};
