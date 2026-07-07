import { NextResponse } from 'next/server';

import { inngest } from '@/inngest/client';
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

  if (topic === 'orders/paid') {
    const bookIds = bookIdsFromOrderPayload(payload);
    for (const bookId of bookIds) {
      // Idempotency: skip if this webhook id was already processed for this order.
      const { data: existing } = await db
        .from('shopify_orders')
        .select('processed_webhook_ids')
        .eq('id', payload.id)
        .maybeSingle();
      if (existing?.processed_webhook_ids?.includes(webhookId)) continue;

      await db.from('shopify_orders').upsert({
        id: payload.id,
        book_id: bookId,
        order_number: String(payload.order_number ?? payload.name ?? ''),
        financial_status: payload.financial_status,
        shipping_address: payload.shipping_address ?? null,
        processed_webhook_ids: [...(existing?.processed_webhook_ids ?? []), webhookId],
        raw: payload,
      });
      await db
        .from('books')
        .update({
          status: 'purchased',
          email: payload.email ?? payload.contact_email ?? null,
          shopify_order_id: payload.id,
          shopify_order_number: String(payload.order_number ?? ''),
          format: detectFormat(payload),
        })
        .eq('id', bookId)
        .in('status', ['preview_ready', 'draft']); // don't regress later states

      await inngest.send({
        name: 'book/purchased',
        data: { bookId, shopifyOrderId: payload.id },
      });
    }
  } else if (topic === 'orders/cancelled' || topic === 'refunds/create') {
    const orderId = topic === 'refunds/create' ? payload.order_id : payload.id;
    const { data: order } = await db
      .from('shopify_orders')
      .select('book_id')
      .eq('id', orderId)
      .maybeSingle();
    if (order?.book_id) {
      await db
        .from('books')
        .update({ status: 'cancelled' })
        .eq('id', order.book_id)
        .not('status', 'in', '("shipped","submitted_to_print")');
      // TODO(print): if already submitted_to_print, attempt Lulu cancellation.
    }
  }

  return NextResponse.json({ ok: true });
}

function detectFormat(order: {
  line_items?: { variant_title?: string | null; properties?: { name: string; value: string }[] }[];
}): 'softcover' | 'hardcover' | null {
  for (const li of order.line_items ?? []) {
    const title = (li.variant_title ?? '').toLowerCase();
    if (title.includes('hard')) return 'hardcover';
    if (title.includes('soft')) return 'softcover';
  }
  return null;
}
