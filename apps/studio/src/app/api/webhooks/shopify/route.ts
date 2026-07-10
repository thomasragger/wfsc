import { NextResponse } from 'next/server';

import { inngest } from '@/inngest/client';
import { captureServer } from '@/lib/analytics';
import { bookIdsForEmail, deleteBookData } from '@/lib/deletion';
import { cancelPrintJob } from '@/lib/lulu';
import { opsAlert } from '@/lib/ops-alert';
import { bookIdsFromOrderPayload, verifyWebhookHmac } from '@/lib/shopify';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Shopify webhooks: orders/paid (trigger full generation), orders/cancelled +
 * refunds/create (halt). HMAC-verified against the raw body; idempotent via
 * X-Shopify-Webhook-Id stored per order. Responds 200 fast — real work runs in
 * Inngest.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmac = request.headers.get('x-shopify-hmac-sha256');
  if (!verifyWebhookHmac(rawBody, hmac)) {
    return NextResponse.json({ error: 'invalid hmac' }, { status: 401 });
  }

  const topic = request.headers.get('x-shopify-topic') ?? '';
  const webhookId = request.headers.get('x-shopify-webhook-id') ?? crypto.randomUUID();
  const payload = JSON.parse(rawBody);
  const db = supabaseAdmin();

  // Mandatory GDPR compliance topics (configured in the app's compliance
  // webhook settings). Must always 200.
  if (topic === 'customers/data_request') {
    await opsAlert(
      'GDPR data request (manual action required within 30 days)',
      JSON.stringify(payload, null, 2),
    );
    return NextResponse.json({ ok: true });
  }
  if (topic === 'customers/redact') {
    const email: string | undefined = payload?.customer?.email;
    const deleted: string[] = [];
    const held: string[] = [];
    if (email) {
      for (const book of await bookIdsForEmail(email)) {
        const inProduction = [
          'purchased',
          'generating',
          'ready_for_review',
          'approved',
          'submitted_to_print',
        ].includes(book.status);
        if (inProduction) {
          held.push(`${book.id} (${book.status})`);
        } else {
          try {
            await deleteBookData(book.id);
            deleted.push(book.id);
          } catch (err) {
            held.push(`${book.id} (delete failed: ${err instanceof Error ? err.message : err})`);
          }
        }
      }
    }
    await opsAlert(
      'GDPR customer redact processed',
      `email=${email ?? 'unknown'}\ndeleted:\n${deleted.join('\n') || '-'}\nneeds manual follow-up:\n${held.join('\n') || '-'}`,
    );
    return NextResponse.json({ ok: true });
  }
  if (topic === 'shop/redact') {
    await opsAlert('GDPR shop redact received (manual action required)', JSON.stringify(payload, null, 2));
    return NextResponse.json({ ok: true });
  }

  if (topic === 'orders/paid') {
    const bookIds = bookIdsFromOrderPayload(payload);

    // Order-level record first (the per-book claims reference it).
    const { data: existing } = await db
      .from('shopify_orders')
      .select('processed_webhook_ids')
      .eq('id', payload.id)
      .maybeSingle();
    await db.from('shopify_orders').upsert({
      id: payload.id,
      order_number: String(payload.order_number ?? payload.name ?? ''),
      financial_status: payload.financial_status,
      shipping_address: payload.shipping_address ?? null,
      processed_webhook_ids: existing?.processed_webhook_ids?.includes(webhookId)
        ? existing.processed_webhook_ids
        : [...(existing?.processed_webhook_ids ?? []), webhookId],
      raw: payload,
    });

    for (const bookId of bookIds) {
      // Per-book idempotency: the (order, book) claim row only inserts once —
      // redelivered webhooks and multi-book carts each process every book
      // exactly once.
      const { data: claimed, error: claimError } = await db
        .from('shopify_order_books')
        .upsert(
          { order_id: payload.id, book_id: bookId },
          { onConflict: 'order_id,book_id', ignoreDuplicates: true },
        )
        .select();
      if (claimError) {
        console.error(`order ${payload.id}: claim failed for book ${bookId}`, claimError);
        continue;
      }
      if (!claimed || claimed.length === 0) continue; // already processed

      await db
        .from('books')
        .update({
          status: 'purchased',
          email: payload.email ?? payload.contact_email ?? null,
          shopify_order_id: payload.id,
          shopify_order_number: String(payload.order_number ?? ''),
          format: detectFormat(payload, bookId),
        })
        .eq('id', bookId)
        .in('status', ['preview_ready', 'draft']); // don't regress later states

      await inngest.send({
        name: 'book/purchased',
        data: { bookId, shopifyOrderId: payload.id },
      });

      // Funnel: purchase completed (server-side, keyed on book id). Only the
      // book format is recorded, never customer/order PII.
      await captureServer('purchase_completed', bookId, {
        format: detectFormat(payload, bookId),
      });
    }
  } else if (topic === 'orders/cancelled' || topic === 'refunds/create') {
    const orderId = topic === 'refunds/create' ? payload.order_id : payload.id;

    // Books on this order: join table + legacy single-book column.
    const [{ data: claims }, { data: order }] = await Promise.all([
      db.from('shopify_order_books').select('book_id').eq('order_id', orderId),
      db.from('shopify_orders').select('book_id').eq('id', orderId).maybeSingle(),
    ]);
    const bookIds = [
      ...new Set([...(claims ?? []).map((c) => c.book_id as string), order?.book_id].filter(
        (v): v is string => !!v,
      )),
    ];

    for (const bookId of bookIds) {
      await db
        .from('books')
        .update({ status: 'cancelled' })
        .eq('id', bookId)
        .not('status', 'in', '("shipped","submitted_to_print")');

      // Already at the printer: try to cancel the Lulu job before it produces.
      const { data: book } = await db
        .from('books')
        .select('id, status')
        .eq('id', bookId)
        .maybeSingle();
      if (book?.status === 'submitted_to_print') {
        const { data: printJob } = await db
          .from('print_jobs')
          .select('id, provider, provider_job_id, status')
          .eq('book_id', bookId)
          .eq('provider', 'lulu')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (printJob?.provider_job_id) {
          try {
            await cancelPrintJob(Number(printJob.provider_job_id));
            await db.from('print_jobs').update({ status: 'CANCELED' }).eq('id', printJob.id);
            await db.from('books').update({ status: 'cancelled' }).eq('id', bookId);
          } catch (err) {
            await opsAlert(
              'Refunded order could not be cancelled at Lulu',
              `book=${bookId} order=${orderId} luluJob=${printJob.provider_job_id}\n${err instanceof Error ? err.message : err}\nCancel manually in the Lulu dashboard before it prints.`,
            );
          }
        } else {
          await opsAlert(
            'Refunded order is submitted to print with no Lulu job on file',
            `book=${bookId} order=${orderId} — check print_jobs and cancel manually.`,
          );
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Format for a specific book: match the line item carrying this book's
 * `_book_id` property (multi-book carts can mix formats); falls back to the
 * first recognizable variant title.
 */
function detectFormat(
  order: {
    line_items?: {
      variant_title?: string | null;
      properties?: { name: string; value: string }[];
    }[];
  },
  bookId: string,
): 'board' | 'softcover' | 'hardcover' | null {
  const fromTitle = (title: string | null | undefined) => {
    const t = (title ?? '').toLowerCase();
    if (t.includes('board')) return 'board' as const;
    if (t.includes('hard')) return 'hardcover' as const;
    if (t.includes('soft')) return 'softcover' as const;
    return null;
  };
  for (const li of order.line_items ?? []) {
    const isThisBook = (li.properties ?? []).some(
      (p) => p.name === '_book_id' && p.value === bookId,
    );
    if (isThisBook) return fromTitle(li.variant_title);
  }
  for (const li of order.line_items ?? []) {
    const format = fromTitle(li.variant_title);
    if (format) return format;
  }
  return null;
}
