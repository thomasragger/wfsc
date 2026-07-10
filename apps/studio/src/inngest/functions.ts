import * as Sentry from '@sentry/nextjs';
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

import { purgeBookSourceAssets } from '@/lib/deletion';
import { recordGenerationJob, type GenerationStage } from '@/lib/generation-jobs';
import {
  generationDelayedEmail,
  previewReadyEmail,
  printSubmittedEmail,
  reviewReadyEmail,
  sendEmail,
} from '@/lib/email';
import { opsAlert } from '@/lib/ops-alert';
import { createPrintJob, type LuluAddress } from '@/lib/lulu';
import { persistImage } from '@/lib/persist';
import { renderAndUploadPdfs } from '@/lib/render';
import { signUrl, signUrls } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabase';
import { inngest } from './client';

const PREVIEW_SPREADS = 2; // free preview: cover + first N spreads
const MAX_RETRIES = 2;

/**
 * Report an Inngest function failure to Sentry with book context. Background
 * function failures aren't HTTP request errors, so onRequestError never sees
 * them: capture them explicitly here. Tags carry ids only, never PII.
 */
function captureInngestFailure(
  fn: string,
  error: unknown,
  tags: Record<string, string | undefined>,
): void {
  Sentry.captureException(error, { tags: { inngest_function: fn, ...tags } });
}

async function loadStyle(styleId: string): Promise<StyleDef> {
  const { data, error } = await supabaseAdmin()
    .from('styles')
    .select('id, style_prompt, reference_image_urls')
    .eq('id', styleId)
    .single();
  if (error || !data) throw new Error(`Style ${styleId} not found: ${error?.message}`);
  return { id: data.id, stylePrompt: data.style_prompt, referenceImageUrls: data.reference_image_urls };
}

/**
 * Send a customer email without ever failing the surrounding function: a
 * misconfigured email provider (unverified domain, bad key) must not mark a
 * successfully generated book as failed. Alerts ops instead.
 */
async function sendEmailSafe(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ sent: boolean }> {
  try {
    await sendEmail(opts);
    return { sent: true };
  } catch (err) {
    await opsAlert(
      'Customer email failed to send',
      `to=${opts.to} subject="${opts.subject}"\n${err instanceof Error ? err.message : err}`,
    );
    return { sent: false };
  }
}

/**
 * Character sheets for the image pipeline, with SIGNED sheet URLs (the DB
 * stores canonical private-bucket URLs; Replicate/Anthropic must be able to
 * fetch them).
 */
async function signedCharacters(
  people: { name: string; role: string | null; character_sheet_url: string; character_description: string }[],
): Promise<CharacterSheet[]> {
  const sheetUrls = await signUrls(people.map((p) => p.character_sheet_url));
  return people.map((p, i) => ({
    name: p.name,
    role: p.role ?? undefined,
    sheetUrl: sheetUrls[i]!,
    description: p.character_description,
  }));
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
  layout: string;
  characters: CharacterSheet[];
  style: StyleDef;
  regenNote?: string;
  /** Storage path for the persisted image (Replicate URLs expire). */
  persistPath: string;
  /** Cost bookkeeping (generation_jobs). */
  bookId: string;
  stage: GenerationStage;
}): Promise<{ imageUrl: string; score: number; notes: string; passed: boolean }> {
  let last = { imageUrl: '', score: 0, notes: 'no attempts', passed: false };
  let attempts = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts++;
    const { imageUrl } = await generateSpreadImage({
      spread: {
        illustration_prompt: opts.prompt,
        copy_space: opts.copySpace,
        layout: opts.layout === 'text-right' ? 'text-right' : 'text-left',
      },
      characters: opts.characters,
      style: opts.style,
      regenNote: opts.regenNote,
    });
    const verdict = await judgeSpreadSafe(imageUrl, opts.characters, opts.style.stylePrompt, undefined, opts.prompt);
    last = { imageUrl, score: verdict.score, notes: verdict.notes, passed: verdict.pass };
    if (verdict.pass) break;
  }
  await recordGenerationJob({
    bookId: opts.bookId,
    stage: opts.stage,
    status: last.passed ? 'succeeded' : 'failed',
    units: attempts,
    error: last.passed ? undefined : `QA ${last.score}: ${last.notes}`,
  });
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
  {
    id: 'generate-preview',
    concurrency: 5,
    retries: 2,
    // When all retries are exhausted, flip the book to a terminal failed
    // state so the UI can show an error + retry instead of spinning forever.
    onFailure: async ({ event, error }) => {
      const bookId = event?.data?.event?.data?.bookId;
      captureInngestFailure('generate-preview', error, { book_id: bookId });
      if (!bookId) return;
      await supabaseAdmin().from('books').update({ status: 'preview_failed' }).eq('id', bookId);
    },
  },
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
        // Story text follows the book's locale; illustration prompts stay
        // English (enforced in the story system prompt).
        language: book.locale === 'de' ? 'German' : 'English',
        targetAge: book.target_age ?? undefined,
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
      await recordGenerationJob({ bookId: book.id, stage: 'story', status: 'succeeded' });
      return generated;
    });

    // 1b. Persist the story spreads (text only) up front, so the waiting
    // screen can show real progress (writing → drawing → painting page N)
    // instead of sitting on "writing" until the very end.
    await step.run('persist-spread-text', async () => {
      for (const [i, s] of story.spreads.entries()) {
        await db.from('book_spreads').upsert(
          {
            book_id: book.id,
            position: i + 1,
            kind: 'story',
            text: s.text,
            illustration_prompt: s.illustration_prompt,
            copy_space: s.copy_space,
            layout: s.layout,
          },
          { onConflict: 'book_id,position' },
        );
      }
    });

    // 2. Character sheets (parallel)
    const characters = await Promise.all(
      book.book_people.map(
        (person: { id: string; name: string; role: string | null; photo_urls: string[] }) =>
          step.run(`character-${person.name}`, async (): Promise<CharacterSheet> => {
            // Photos + sheets live in private buckets: sign everything the
            // image/vision models must fetch; store canonical URLs in the DB.
            const photoUrls = (await signUrls(person.photo_urls)).filter(
              (u): u is string => !!u,
            );
            const { sheetUrl: transientSheetUrl } = await generateCharacterSheet(
              { name: person.name, role: person.role ?? undefined, photoUrls },
              style,
            );
            const sheetUrl = await persistImage(
              transientSheetUrl,
              `books/${book.id}/sheets/${person.id}.png`,
            );
            const signedSheetUrl = (await signUrl(sheetUrl))!;
            const description = await describeCharacter(
              { name: person.name, role: person.role ?? undefined, photoUrls: [] },
              signedSheetUrl,
            );
            await db
              .from('book_people')
              .update({ character_sheet_url: sheetUrl, character_description: description })
              .eq('id', person.id);
            await recordGenerationJob({
              bookId: book.id,
              stage: 'character_sheet',
              status: 'succeeded',
              subjectId: person.id,
            });
            return {
              name: person.name,
              role: person.role ?? undefined,
              sheetUrl: signedSheetUrl,
              description,
            };
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
    // Each image persists the moment it's ready (cover → books row, spreads →
    // their book_spreads row) so the waiting screen advances page by page.
    const generated = await Promise.all(
      previewTargets.map((t, idx) =>
        step.run(`preview-${t.key}`, async () => {
          const r = await generateAndJudgeSpread({
            ...t,
            characters,
            style,
            persistPath: `books/${book.id}/${t.key}.png`,
            bookId: book.id,
            stage: 'preview_spread',
          });
          if (t.key === 'cover') {
            await db.from('books').update({ cover_image_url: r.imageUrl }).eq('id', book.id);
          } else {
            await db
              .from('book_spreads')
              .update({ image_url: r.imageUrl, qa_score: r.score, qa_notes: r.notes })
              .eq('book_id', book.id)
              .eq('position', idx); // cover is idx 0, so spread-1 is position 1, etc.
          }
          return { key: t.key, ...r };
        }),
      ),
    );

    await step.run('mark-preview-ready', async () => {
      await db.from('books').update({ status: 'preview_ready' }).eq('id', book.id);
    });

    await step.run('send-preview-email', async () => {
      if (!book.email) return { skipped: 'no email' };
      const mail = previewReadyEmail(book);
      return sendEmailSafe({ to: book.email, ...mail });
    });

    return { bookId: book.id, previewImages: generated.length };
  },
);

/**
 * Full generation after purchase: remaining spreads + upscale everything.
 * Triggered by the orders/paid webhook.
 */
export const generateFullBook = inngest.createFunction(
  {
    id: 'generate-full-book',
    concurrency: 3,
    retries: 2,
    // A PAID order must never strand silently: land in a terminal failed
    // state, tell the customer it's delayed, and page ops.
    onFailure: async ({ event, error }) => {
      const bookId = event?.data?.event?.data?.bookId;
      captureInngestFailure('generate-full-book', error, { book_id: bookId });
      if (!bookId) return;
      const db = supabaseAdmin();
      await db.from('books').update({ status: 'generation_failed' }).eq('id', bookId);
      const { data: book } = await db
        .from('books')
        .select('email, title, access_token, locale')
        .eq('id', bookId)
        .maybeSingle();
      if (book?.email) {
        await sendEmail({
          to: book.email,
          ...generationDelayedEmail(book),
        }).catch((err) => console.error('delay email failed', err));
      }
      await opsAlert(
        'PAID book failed full generation',
        `book=${bookId}\n${error?.message ?? 'retries exhausted'}\nFix the cause, set status back to 'purchased', and re-send book/purchased.`,
      );
    },
  },
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

    const characters = await step.run('sign-characters', () =>
      signedCharacters(book.book_people),
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
            bookId: book.id,
            stage: 'spread',
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
            const { imageUrl } = await upscaleImage((await signUrl(s.image_url))!);
            const persisted = await persistImage(imageUrl, `books/${book.id}/print/${s.id}.png`);
            await db.from('book_spreads').update({ print_image_url: persisted }).eq('id', s.id);
            await recordGenerationJob({
              bookId: book.id,
              stage: 'upscale',
              status: 'succeeded',
              subjectId: s.id,
            });
          }),
        ),
    );
    await step.run('upscale-cover', async () => {
      const fresh = await loadBook(book.id);
      if (fresh.cover_image_url && !fresh.cover_print_image_url) {
        const { imageUrl } = await upscaleImage((await signUrl(fresh.cover_image_url))!);
        const persisted = await persistImage(imageUrl, `books/${book.id}/print/cover.png`);
        await db.from('books').update({ cover_print_image_url: persisted }).eq('id', book.id);
      }
    });

    // QA floor for PAID books: sub-threshold spreads still ship to the review
    // page (the customer sees and explicitly approves every spread before
    // print), but ops gets paged so flagged pages can be regenerated
    // proactively instead of the customer discovering them.
    await step.run('qa-floor-check', async () => {
      const threshold = Number(process.env.WFSC_QA_THRESHOLD ?? 70);
      const { data: flagged } = await db
        .from('book_spreads')
        .select('position, qa_score, qa_notes')
        .eq('book_id', book.id)
        .lt('qa_score', threshold)
        .order('position');
      if (flagged && flagged.length > 0) {
        await opsAlert(
          `Paid book has ${flagged.length} spread(s) below QA threshold`,
          `book=${book.id}\n${flagged
            .map((f) => `position ${f.position}: score ${f.qa_score} — ${f.qa_notes}`)
            .join('\n')}\nRegenerate them before the customer reviews if possible.`,
        );
      }
      return { flagged: flagged?.length ?? 0 };
    });

    await step.run('mark-ready', async () => {
      await db.from('books').update({ status: 'ready_for_review' }).eq('id', book.id);
    });

    await step.run('send-review-email', async () => {
      const fresh = await loadBook(book.id);
      if (!fresh.email) return { skipped: 'no email on book' };
      const mail = reviewReadyEmail(fresh);
      return sendEmailSafe({ to: fresh.email, ...mail });
    });

    return { bookId: book.id };
  },
);

/** Regenerate a single spread with the customer's adjustment note (editor). */
export const regenerateSpread = inngest.createFunction(
  {
    id: 'regenerate-spread',
    concurrency: 5,
    retries: 2,
    // Not a terminal book state (the old image is still in place) — but the
    // customer asked for a change and silently keeping the old art loses
    // trust, so page ops.
    onFailure: async ({ event, error }) => {
      const data = event?.data?.event?.data;
      captureInngestFailure('regenerate-spread', error, {
        book_id: data?.bookId,
        spread_id: data?.spreadId,
      });
      await opsAlert(
        'Spread regeneration failed',
        `book=${data?.bookId} spread=${data?.spreadId}\n${error?.message ?? 'retries exhausted'}\nThe previous image is still in place; re-send book/spread.regenerate after fixing.`,
      );
    },
  },
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

    const characters = await step.run('sign-characters', () =>
      signedCharacters(book.book_people),
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
        bookId: book.id,
        stage: 'regen_spread',
      });
      const { imageUrl: transientPrintUrl } = await upscaleImage((await signUrl(result.imageUrl))!);
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
  {
    id: 'submit-to-print',
    concurrency: 2,
    retries: 3,
    onFailure: async ({ event, error }) => {
      const bookId = event?.data?.event?.data?.bookId;
      captureInngestFailure('submit-to-print', error, { book_id: bookId });
      if (!bookId) return;
      await supabaseAdmin().from('books').update({ status: 'print_failed' }).eq('id', bookId);
      await opsAlert(
        'APPROVED book failed print submission',
        `book=${bookId}\n${error?.message ?? 'retries exhausted'}\nFix the cause, set status back to 'approved', and re-send book/approved.`,
      );
    },
  },
  { event: 'book/approved' },
  async ({ event, step }) => {
    const db = supabaseAdmin();
    const book = await step.run('load-book', () => loadBook(event.data.bookId));
    if (book.status !== 'approved') {
      return { skipped: true, reason: `status is ${book.status}` };
    }

    if (!book.shopify_order_id) throw new Error(`Book ${book.id} has no linked Shopify order`);
    const { data: order } = await db
      .from('shopify_orders')
      .select('shipping_address')
      .eq('id', book.shopify_order_id)
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
    if (!addr.country_code) {
      // Never guess a shipping country — hold the job for a human instead.
      await step.run('hold-missing-country', async () => {
        await db.from('books').update({ status: 'print_failed' }).eq('id', book.id);
        await opsAlert(
          'Print job held: order has no shipping country',
          `book=${book.id} order=${book.shopify_order_id}\nFix the address on the order, set the book back to 'approved', and re-send book/approved.`,
        );
      });
      return { held: 'missing shipping country' };
    }

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
      // Lulu has no board-book SKU. Hold board orders for manual/alternate-printer
      // fulfillment instead of silently printing them as something else.
      if ((book.format ?? 'hardcover') === 'board') {
        await db.from('print_jobs').insert({
          book_id: book.id,
          provider: 'manual',
          provider_job_id: `manual-${book.id}`,
          status: 'NEEDS_MANUAL_FULFILLMENT',
          raw: { note: 'Board book — Lulu has no board SKU; route to a board-book POD printer.' },
        });
        await db.from('books').update({ status: 'submitted_to_print' }).eq('id', book.id);
        return { manual: true as const };
      }
      const shippingAddress: LuluAddress = {
        name: addr.name ?? `${addr.first_name ?? ''} ${addr.last_name ?? ''}`.trim(),
        street1: addr.address1!,
        street2: addr.address2 ?? undefined,
        city: addr.city ?? '',
        postcode: addr.zip ?? '',
        country_code: addr.country_code!,
        state_code: addr.province_code ?? undefined,
        phone_number: addr.phone ?? undefined,
        email: book.email ?? undefined,
      };
      const job = await createPrintJob({
        externalId: book.id,
        format: (book.format ?? 'hardcover') as 'softcover' | 'hardcover',
        pageCount: book.page_count,
        title: book.title ?? 'Personalized Storybook',
        interiorPdfUrl: pdfs.signedInteriorUrl,
        coverPdfUrl: pdfs.signedCoverUrl,
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
      return sendEmailSafe({ to: book.email, ...mail });
    });

    return { bookId: book.id, ...printJob };
  },
);

/**
 * Daily retention pass (GDPR data minimization): RETENTION_DAYS after a book
 * ships or is cancelled, delete the customer's source photos and character
 * sheets. The finished book stays viewable via its link.
 */
export const retentionPurge = inngest.createFunction(
  { id: 'retention-purge', retries: 1 },
  { cron: '0 4 * * *' },
  async ({ step }) => {
    const days = Number(process.env.RETENTION_DAYS ?? 30);
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

    const due = await step.run('find-due-books', async () => {
      const { data, error } = await supabaseAdmin()
        .from('books')
        .select('id, is_sample')
        .in('status', ['shipped', 'cancelled'])
        .is('assets_purged_at', null)
        .lt('updated_at', cutoff)
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []).filter((b) => !b.is_sample).map((b) => b.id as string);
    });

    const failed: string[] = [];
    for (const bookId of due) {
      // Return success from the step (not via closure) so replays after a
      // memoized step still reconstruct the failure list correctly.
      const ok = await step.run(`purge-${bookId}`, async () => {
        try {
          await purgeBookSourceAssets(bookId);
          return true;
        } catch (err) {
          console.error(`retention purge failed for ${bookId}`, err);
          captureInngestFailure('retention-purge', err, { book_id: bookId });
          return false;
        }
      });
      if (!ok) failed.push(bookId);
    }
    if (failed.length > 0) {
      await step.run('alert-failures', () =>
        opsAlert('Retention purge failures', `Books that failed to purge:\n${failed.join('\n')}`),
      );
    }
    return { purged: due.length - failed.length, failed: failed.length };
  },
);

export const functions = [
  generatePreview,
  generateFullBook,
  regenerateSpread,
  submitToPrint,
  retentionPurge,
];
