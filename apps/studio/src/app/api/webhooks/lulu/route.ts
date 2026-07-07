import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { fulfillOrderWithTracking } from '@/lib/shopify';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Lulu PRINT_JOB_STATUS_CHANGED webhook. HMAC-SHA256 signed with the API
 * secret in the `Lulu-HMAC-SHA256` header. On SHIPPED, mirror tracking into
 * Shopify via fulfillmentCreate (Shopify then emails the customer).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('lulu-hmac-sha256');
  const secret = process.env.LULU_CLIENT_SECRET ?? '';
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!signature || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
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
      .select('id, shopify_order_id')
      .eq('id', job.external_id)
      .maybeSingle();
    const tracking = job.line_items?.find((li) => li.tracking_id);
    if (book?.shopify_order_id && tracking?.tracking_id) {
      await fulfillOrderWithTracking({
        orderId: book.shopify_order_id,
        trackingNumber: tracking.tracking_id,
        trackingUrl: tracking.tracking_urls?.[0],
      });
      await db.from('books').update({ status: 'shipped' }).eq('id', book.id);
      await db
        .from('print_jobs')
        .update({ tracking: [{ number: tracking.tracking_id, url: tracking.tracking_urls?.[0] }] })
        .eq('provider_job_id', String(job.id));
    }
  }

  return NextResponse.json({ ok: true });
}
