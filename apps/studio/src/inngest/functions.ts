import {
  describeCharacter,
  generateCharacterSheet,
  generateSpreadImage,
  generateStory,
  judgeSpreadSafe,
  upscaleImage,
  type CharacterSheet,
  type Story,
  type StyleDef,
} from '@wfsc/pipeline';

import { reviewReadyEmail, printSubmittedEmail, sendEmail } from '@/lib/email';
import { createPrintJob, type LuluAddress } from '@/lib/lulu';
import { persistImage } from '@/lib/persist';
import { renderAndUploadPdfs } from '@/lib/render';
import { supabaseAdmin } from '@/lib/supabase';
import { inngest } from './client';

const PREVIEW_SPREADS = 2; // free preview: cover + first N spreads
const MAX_RETRIES = 2;

async function loadStyle(styleId: string): Promise<StyleDef> {
  const { data, error } = await supabaseAdmin()
    .from('styles')
    .select('id, style_prompt, reference_image_urls')
    .eq('id', styleId)
    .single();
  if (error || !data) throw new Error(`Style ${styleId} not found: ${error?.message}`);
  return { id: data.id, stylePrompt: data.style_prompt, referenceImageUrls: data.reference_image_urls };
}

async function loadBook(bookId: string) {
  const { data, error } = await supabaseAdmin()
    .from('books')
    .select('*, book_people(*), story_templates(title, story_beats, prompt_scaffold, cover_concept)')
    .eq('id', bookId)
    .single();
  if (error || !data) throw new Error(`Book ${bookId} not found: ${error?.message}`);
  return data;
}

async function generateAndJudgeSpread(opts: {
  prompt: string;
  copySpace: string;
  layout: 'text-left' | 'text-right' | 'full-bleed-overlay' | 'text-bottom';
  characters: CharacterSheet[];
  style: StyleDef;
  regenNote?: string;
  /** Storage path for the persisted image (Replicate URLs expire). */
  persistPath: string;
}): Promise<{ imageUrl: string; score: number; notes: string }> {
  let last = { imageUrl: '', score: 0, notes: 'no attempts' };
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { imageUrl } = await generateSpreadImage({
      spread: { illustration_prompt: opts.prompt, copy_space: opts.copySpace, layout: opts.layout },
      characters: opts.characters,
      style: opts.style,
      regenNote: opts.regenNote,
    });
    const verdict = await judgeSpreadSafe(imageUrl, opts.characters, opts.style.stylePrompt);
    last = { imageUrl, score: verdict.score, notes: verdict.notes };
    if (verdict.pass) break;
  }
  if (last.imageUrl) {
    last.imageUrl = await persistImage(last.imageUrl, opts.persistPath);
  }
  return last;
}

/**
 * Free preview: story + character sheets + cover + first spreads.
 * Triggered when the customer finishes intake.
 */
export const generatePreview = inngest.createFunction(
  { id: 'generate-preview', concurrency: 5, retries: 2 },
  { event: 'book/preview.requested' },
  async ({ event, step }) => {
    const db = supabaseAdmin();
    const book = await step.run('load-book', () => loadBook(event.data.bookId));
    const style = await step.run('load-style', () => loadStyle(book.style_id));

    await step.run('mark-generating', async () => {
      await db.from('books').update({ status: 'preview_generating' }).eq('id', book.id);
    });

    // 1. Story
    const story = await step.run('story', async (): Promise<Story> => {
      if (book.story) return book.story as Story;
      const generated = await generateStory({
        memoryText: book.memory_text,
        people: book.book_people.map((p: { name: string; role: string | null }) => ({
          name: p.name,
          role: p.role ?? undefined,
          photoUrls: [],
        })),
        template: book.story_templates
          ? {
              title: book.story_templates.title,
              storyBeats: book.story_templates.story_beats as string[],
              promptScaffold: book.story_templates.prompt_scaffold,
              coverConcept: book.story_templates.cover_concept,
            }
          : undefined,
      });
      await db
        .from('books')
        .update({ story: generated, title: generated.title })
        .eq('id', book.id);
      return generated;
    });

    // 2. Character sheets (parallel)
    const characters = await Promise.all(
      book.book_people.map(
        (person: { id: string; name: string; role: string | null; photo_urls: string[] }) =>
          step.run(`character-${person.name}`, async (): Promise<CharacterSheet> => {
            const { sheetUrl: transientSheetUrl } = await generateCharacterSheet(
              { name: person.name, role: person.role ?? undefined, photoUrls: person.photo_urls },
              style,
            );
            const sheetUrl = await persistImage(
              transientSheetUrl,
              `books/${book.id}/sheets/${person.id}.png`,
            );
            const description = await describeCharacter(
              { name: person.name, role: person.role ?? undefined, photoUrls: [] },
              sheetUrl,
            );
            await db
              .from('book_people')
              .update({ character_sheet_url: sheetUrl, character_description: description })
              .eq('id', person.id);
            return { name: person.name, role: person.role ?? undefined, sheetUrl, description };
          }),
      ),
    );

    // 3. Cover + first N spreads (parallel)
    const previewTargets = [
      { key: 'cover', prompt: story.cover_prompt, copySpace: 'upper third for title', layout: 'text-left' as const },
      ...story.spreads.slice(0, PREVIEW_SPREADS).map((s, i) => ({
        key: `spread-${i + 1}`,
        prompt: s.illustration_prompt,
        copySpace: s.copy_space,
        layout: s.layout,
      })),
    ];
    const generated = await Promise.all(
      previewTargets.map((t) =>
        step.run(`preview-${t.key}`, () =>
          generateAndJudgeSpread({
            ...t,
            characters,
            style,
            persistPath: `books/${book.id}/${t.key}.png`,
          }).then((r) => ({ key: t.key, ...r })),
        ),
      ),
    );

    await step.run('persist-preview', async () => {
      const cover = generated.find((g) => g.key === 'cover');
      if (cover) await db.from('books').update({ cover_image_url: cover.imageUrl }).eq('id', book.id);
      for (const [i, s] of story.spreads.entries()) {
        const gen = generated.find((g) => g.key === `spread-${i + 1}`);
        await db.from('book_spreads').upsert(
          {
            book_id: book.id,
            position: i + 1,
            kind: 'story',
            text: s.text,
            illustration_prompt: s.illustration_prompt,
            copy_space: s.copy_space,
            layout: s.layout,
            image_url: gen?.imageUrl ?? null,
            qa_score: gen?.score ?? null,
            qa_notes: gen?.notes ?? null,
          },
          { onConflict: 'book_id,position' },
        );
      }
      await db.from('books').update({ status: 'preview_ready' }).eq('id', book.id);
    });

    return { bookId: book.id, previewImages: generated.length };
  },
);

/**
 * Full generation after purchase: remaining spreads + upscale everything.
 * Triggered by the orders/paid webhook.
 */
export const generateFullBook = inngest.createFunction(
  { id: 'generate-full-book', concurrency: 3, retries: 2 },
  { event: 'book/purchased' },
  async ({ event, step }) => {
    const db = supabaseAdmin();
    const book = await step.run('load-book', () => loadBook(event.data.bookId));
    const style = await step.run('load-style', () => loadStyle(book.style_id));
    const story = book.story as Story;
    if (!story) throw new Error(`Book ${book.id} has no story`);

    await step.run('mark-generating', async () => {
      await db.from('books').update({ status: 'generating' }).eq('id', book.id);
    });

    const characters: CharacterSheet[] = book.book_people.map(
      (p: { name: string; role: string | null; character_sheet_url: string; character_description: string }) => ({
        name: p.name,
        role: p.role ?? undefined,
        sheetUrl: p.character_sheet_url,
        description: p.character_description,
      }),
    );

    const { data: existing } = await db
      .from('book_spreads')
      .select('position, image_url')
      .eq('book_id', book.id);
    const hasImage = new Set((existing ?? []).filter((s) => s.image_url).map((s) => s.position));

    // Generate all missing spreads in parallel.
    await Promise.all(
      story.spreads.map((s, i) => {
        const position = i + 1;
        if (hasImage.has(position)) return Promise.resolve();
        return step.run(`spread-${position}`, async () => {
          const result = await generateAndJudgeSpread({
            prompt: s.illustration_prompt,
            copySpace: s.copy_space,
            layout: s.layout,
            characters,
            style,
            persistPath: `books/${book.id}/spread-${position}.png`,
          });
          await db.from('book_spreads').upsert(
            {
              book_id: book.id,
              position,
              kind: 'story',
              text: s.text,
              illustration_prompt: s.illustration_prompt,
              copy_space: s.copy_space,
              layout: s.layout,
              image_url: result.imageUrl,
              qa_score: result.score,
              qa_notes: result.notes,
            },
            { onConflict: 'book_id,position' },
          );
        });
      }),
    );

    // Upscale all spreads + cover to print resolution.
    const { data: spreads } = await db
      .from('book_spreads')
      .select('id, image_url, print_image_url')
      .eq('book_id', book.id);
    await Promise.all(
      (spreads ?? [])
        .filter((s) => s.image_url && !s.print_image_url)
        .map((s) =>
          step.run(`upscale-${s.id}`, async () => {
            const { imageUrl } = await upscaleImage(s.image_url!);
            const persisted = await persistImage(imageUrl, `books/${book.id}/print/${s.id}.png`);
            await db.from('book_spreads').update({ print_image_url: persisted }).eq('id', s.id);
          }),
        ),
    );
    await step.run('upscale-cover', async () => {
      const fresh = await loadBook(book.id);
      if (fresh.cover_image_url && !fresh.cover_print_image_url) {
        const { imageUrl } = await upscaleImage(fresh.cover_image_url);
        const persisted = await persistImage(imageUrl, `books/${book.id}/print/cover.png`);
        await db.from('books').update({ cover_print_image_url: persisted }).eq('id', book.id);
      }
    });

    await step.run('mark-ready', async () => {
      await db.from('books').update({ status: 'ready_for_review' }).eq('id', book.id);
    });

    await step.run('send-review-email', async () => {
      const fresh = await loadBook(book.id);
      if (!fresh.email) return { skipped: 'no email on book' };
      const mail = reviewReadyEmail(fresh);
      await sendEmail({ to: fresh.email, ...mail });
      return { sent: true };
    });

    return { bookId: book.id };
  },
);

/** Regenerate a single spread with the customer's adjustment note (editor). */
export const regenerateSpread = inngest.createFunction(
  { id: 'regenerate-spread', concurrency: 5, retries: 2 },
  { event: 'book/spread.regenerate' },
  async ({ event, step }) => {
    const db = supabaseAdmin();
    const book = await step.run('load-book', () => loadBook(event.data.bookId));
    const style = await step.run('load-style', () => loadStyle(book.style_id));
    const { data: spread, error } = await supabaseAdmin()
      .from('book_spreads')
      .select('*')
      .eq('id', event.data.spreadId)
      .single();
    if (error || !spread) throw new Error(`Spread ${event.data.spreadId} not found`);

    const characters: CharacterSheet[] = book.book_people.map(
      (p: { name: string; role: string | null; character_sheet_url: string; character_description: string }) => ({
        name: p.name,
        role: p.role ?? undefined,
        sheetUrl: p.character_sheet_url,
        description: p.character_description,
      }),
    );

    await step.run('regenerate', async () => {
      const result = await generateAndJudgeSpread({
        prompt: spread.illustration_prompt,
        copySpace: spread.copy_space ?? 'soft area near the top',
        layout: spread.layout,
        characters,
        style,
        regenNote: spread.regen_note ?? undefined,
        persistPath: `books/${book.id}/spread-${spread.position}-r${Date.now()}.png`,
      });
      const { imageUrl: transientPrintUrl } = await upscaleImage(result.imageUrl);
      const printUrl = await persistImage(
        transientPrintUrl,
        `books/${book.id}/print/${spread.id}.png`,
      );
      await db
        .from('book_spreads')
        .update({
          image_url: result.imageUrl,
          print_image_url: printUrl,
          qa_score: result.score,
          qa_notes: result.notes,
        })
        .eq('id', spread.id);
    });

    return { spreadId: event.data.spreadId };
  },
);

/**
 * After the customer approves the final book: render print PDFs, upload them
 * publicly, and submit the Lulu print job with the order's shipping address.
 */
export const submitToPrint = inngest.createFunction(
  { id: 'submit-to-print', concurrency: 2, retries: 3 },
  { event: 'book/approved' },
  async ({ event, step }) => {
    const db = supabaseAdmin();
    const book = await step.run('load-book', () => loadBook(event.data.bookId));
    if (book.status !== 'approved') {
      return { skipped: true, reason: `status is ${book.status}` };
    }

    const { data: order } = await db
      .from('shopify_orders')
      .select('shipping_address')
      .eq('book_id', book.id)
      .maybeSingle();
    const addr = order?.shipping_address as {
      name?: string;
      first_name?: string;
      last_name?: string;
      address1?: string;
      address2?: string;
      city?: string;
      zip?: string;
      country_code?: string;
      province_code?: string;
      phone?: string;
    } | null;
    if (!addr?.address1) throw new Error(`Book ${book.id} has no shipping address`);

    const pdfs = await step.run('render-pdfs', async () => {
      const { data: spreads } = await db
        .from('book_spreads')
        .select('*')
        .eq('book_id', book.id)
        .order('position');
      const result = await renderAndUploadPdfs(book, spreads ?? []);
      await db
        .from('books')
        .update({ pdf_interior_url: result.interiorUrl, pdf_cover_url: result.coverUrl })
        .eq('id', book.id);
      return result;
    });

    const printJob = await step.run('submit-lulu', async () => {
      const shippingAddress: LuluAddress = {
        name: addr.name ?? `${addr.first_name ?? ''} ${addr.last_name ?? ''}`.trim(),
        street1: addr.address1!,
        street2: addr.address2 ?? undefined,
        city: addr.city ?? '',
        postcode: addr.zip ?? '',
        country_code: addr.country_code ?? 'AT',
        state_code: addr.province_code ?? undefined,
        phone_number: addr.phone ?? undefined,
        email: book.email ?? undefined,
      };
      const job = await createPrintJob({
        externalId: book.id,
        format: (book.format ?? 'hardcover') as 'softcover' | 'hardcover',
        pageCount: book.page_count,
        title: book.title ?? 'Personalized Storybook',
        interiorPdfUrl: pdfs.interiorUrl,
        coverPdfUrl: pdfs.coverUrl,
        shippingAddress,
      });
      await db.from('print_jobs').insert({
        book_id: book.id,
        provider: 'lulu',
        provider_job_id: String(job.id),
        status: job.status?.name ?? 'CREATED',
        raw: job,
      });
      await db.from('books').update({ status: 'submitted_to_print' }).eq('id', book.id);
      return { luluJobId: job.id };
    });

    await step.run('send-print-email', async () => {
      if (!book.email) return { skipped: 'no email on book' };
      const mail = printSubmittedEmail(book);
      await sendEmail({ to: book.email, ...mail });
      return { sent: true };
    });

    return { bookId: book.id, ...printJob };
  },
);

export const functions = [generatePreview, generateFullBook, regenerateSpread, submitToPrint];
