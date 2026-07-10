import {
  BOOK_ASSETS_BUCKET,
  deleteStoragePrefix,
  deleteStorageUrls,
} from './storage';
import { supabaseAdmin } from './supabase';

/**
 * GDPR erasure + retention helpers. Two levels:
 *
 * - deleteBookData: full erasure — every storage object and DB row for a book
 *   (order rows are kept for bookkeeping but stripped of PII and unlinked).
 * - purgeBookSourceAssets: retention pass — removes the sensitive inputs
 *   (customer photos, character sheets) while keeping the finished book
 *   viewable via its link.
 */

async function loadPeoplePhotoUrls(bookId: string): Promise<string[]> {
  const { data } = await supabaseAdmin()
    .from('book_people')
    .select('photo_urls')
    .eq('book_id', bookId);
  return (data ?? []).flatMap((p: { photo_urls: string[] | null }) => p.photo_urls ?? []);
}

/** Erase a book completely: storage objects, DB rows, PII on linked orders. */
export async function deleteBookData(bookId: string): Promise<void> {
  const db = supabaseAdmin();

  const { data: book } = await db
    .from('books')
    .select('id, is_sample')
    .eq('id', bookId)
    .maybeSingle();
  if (!book) return;
  if (book.is_sample) throw new Error(`Refusing to delete sample book ${bookId}`);

  // Storage first (a re-run can still find the URLs if a later step fails).
  await deleteStorageUrls(await loadPeoplePhotoUrls(bookId));
  await deleteStoragePrefix(BOOK_ASSETS_BUCKET, `books/${bookId}`);
  // Legacy locations from before the private-bucket split (best-effort).
  await deleteStoragePrefix('renders', `books/${bookId}`).catch(() => undefined);
  await deleteStoragePrefix('print', bookId).catch(() => undefined);

  // Orders: keep the financial record, drop the personal data and the link.
  await db
    .from('shopify_orders')
    .update({ book_id: null, shipping_address: null, raw: null })
    .eq('book_id', bookId);
  await db.from('print_jobs').delete().eq('book_id', bookId);

  // Cascades to book_people, book_spreads, generation_jobs.
  const { error } = await db.from('books').delete().eq('id', bookId);
  if (error) throw new Error(`deleteBookData(${bookId}): ${error.message}`);
}

/**
 * Retention purge: remove source photos + character sheets for a delivered or
 * cancelled book, keeping the book itself viewable. Idempotent; stamps
 * books.assets_purged_at.
 */
export async function purgeBookSourceAssets(bookId: string): Promise<void> {
  const db = supabaseAdmin();

  await deleteStorageUrls(await loadPeoplePhotoUrls(bookId));
  await deleteStoragePrefix(BOOK_ASSETS_BUCKET, `books/${bookId}/sheets`);

  const { error: peopleError } = await db
    .from('book_people')
    .update({ photo_urls: [], character_sheet_url: null })
    .eq('book_id', bookId);
  if (peopleError) throw new Error(`purge people(${bookId}): ${peopleError.message}`);

  const { error } = await db
    .from('books')
    .update({ assets_purged_at: new Date().toISOString() })
    .eq('id', bookId);
  if (error) throw new Error(`purge stamp(${bookId}): ${error.message}`);
}

/** All non-sample books tied to an email address (for GDPR redaction). */
export async function bookIdsForEmail(email: string): Promise<{ id: string; status: string }[]> {
  const { data } = await supabaseAdmin()
    .from('books')
    .select('id, status, is_sample')
    .ilike('email', email);
  return ((data ?? []) as { id: string; status: string; is_sample: boolean | null }[])
    .filter((b) => !b.is_sample)
    .map((b) => ({ id: b.id, status: b.status }));
}
