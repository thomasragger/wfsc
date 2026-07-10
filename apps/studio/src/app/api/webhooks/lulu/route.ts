import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { opsAlert } from '@/lib/ops-alert';
import { fulfillOrderWithTracking } from '@/lib/shopify';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Lulu PRINT_JOB_STATUS_CHANGED webhook. HMAC-SHA256 signed with the API
 * secret in the `Lulu-HMAC-SHA256` header. On SHIPPED, mirror tracking into
 * Shopify via fulfillmentCreate (Shopify then emails the customer).
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.LULU_CLIENT_SECRET ?? '';
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    // timingSafeEqual throws on length mismatch — that's still just a bad
    // signature, not a server error.
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get('lulu-hmac-sha256'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    data?: {
      id: number;
      status?: { name: string };
      external_id?: string;
      line_items?: { tracking_id?: string | null; tracking_urls?: string[] | null }[];
    };
  };
  const job = payload.data;
  if (!job) return NextResponse.json({ ok: true });

  const db = supabaseAdmin();
  const statusName = job.status?.name ?? 'UNKNOWN';

  await db
    .from('print_jobs')
    .update({ status: statusName, raw: job })
    .eq('provider_job_id', String(job.id));

  if (statusName === 'SHIPPED' && job.external_id) {
    const { data: book } = await db
      .from('books')
      .select('id, status, shopify_order_id')
      .eq('id', job.external_id)
      .maybeSingle();
    // Idempotency: Lulu redelivers on non-2xx; once the book is shipped the
    // fulfillment already exists and re-creating it would 500 forever.
    if (book?.status === 'shipped') {
      return NextResponse.json({ ok: true, alreadyShipped: true });
    }
    const tracking = job.line_items?.find((li) => li.tracking_id);
    if (book?.shopify_order_id && tracking?.tracking_id) {
      await db
        .from('print_jobs')
        .update({ tracking: [{ number: tracking.tracking_id, url: tracking.tracking_urls?.[0] }] })
        .eq('provider_job_id', String(job.id));
      try {
        await fulfillOrderWithTracking({
          orderId: book.shopify_order_id,
          trackingNumber: tracking.tracking_id,
          trackingUrl: tracking.tracking_urls?.[0],
        });
      } catch (err) {
        // Accept the webhook anyway (tracking is saved above) and hand the
        // fulfillment to a human — endless Lulu redelivery won't fix Shopify.
        await opsAlert(
          'Lulu SHIPPED but Shopify fulfillment failed',
          `book=${book.id} order=${book.shopify_order_id} tracking=${tracking.tracking_id}\n${err instanceof Error ? err.message : err}\nCreate the fulfillment manually in Shopify admin.`,
        );
      }
      await db.from('books').update({ status: 'shipped' }).eq('id', book.id);
    } else if (book) {
      await opsAlert(
        'Lulu SHIPPED without usable tracking or order link',
        `book=${book.id} order=${book.shopify_order_id ?? 'none'} luluJob=${job.id} — fulfill manually.`,
      );
    }
  }

  return NextResponse.json({ ok: true });
}
