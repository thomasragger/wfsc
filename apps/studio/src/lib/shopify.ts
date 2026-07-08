import crypto from 'node:crypto';

/**
 * Shopify integration for a single-store custom app.
 * - Storefront API: cartCreate with hidden `_book_id` line attribute
 * - Admin GraphQL: order lookup, fulfillment with tracking
 * - Webhook HMAC verification
 * API version pinned; GraphQL only (REST Admin API is legacy).
 */
const API_VERSION = '2026-01';

function shopDomain(): string {
  const d = process.env.SHOPIFY_SHOP_DOMAIN; // e.g. warm-fuzzy-story-club.myshopify.com
  if (!d) throw new Error('SHOPIFY_SHOP_DOMAIN not configured');
  return d;
}

/**
 * Admin access token. Dev-Dashboard custom apps don't expose a static token;
 * we mint short-lived tokens via the client credentials grant (client ID +
 * secret) and cache until expiry. A static SHOPIFY_ADMIN_TOKEN env var, if
 * set, takes precedence (useful for legacy admin-created apps).
 */
let cachedAdminToken: { token: string; expiresAt: number } | null = null;

async function adminToken(): Promise<string> {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (cachedAdminToken && Date.now() < cachedAdminToken.expiresAt - 120_000) {
    return cachedAdminToken.token;
  }
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET not configured');
  }
  const res = await fetch(`https://${shopDomain()}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Shopify token grant failed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedAdminToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 86_000) * 1000,
  };
  return cachedAdminToken.token;
}

async function graphql<T>(
  endpoint: 'storefront' | 'admin',
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const url =
    endpoint === 'storefront'
      ? `https://${shopDomain()}/api/${API_VERSION}/graphql.json`
      : `https://${shopDomain()}/admin/api/${API_VERSION}/graphql.json`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (endpoint === 'storefront') {
    headers['X-Shopify-Storefront-Access-Token'] = process.env.SHOPIFY_STOREFRONT_TOKEN ?? '';
  } else {
    headers['X-Shopify-Access-Token'] = await adminToken();
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  if (!res.ok) throw new Error(`Shopify ${endpoint} HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(`Shopify ${endpoint} error: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

/**
 * Create a cart containing the chosen variant with the hidden `_book_id`
 * attribute and return the Shopify-hosted checkout URL.
 */
export async function createCheckout(opts: {
  variantId: string; // gid://shopify/ProductVariant/...
  bookId: string;
  bookTitle: string;
}): Promise<{ checkoutUrl: string; cartId: string }> {
  interface CartCreateResult {
    cartCreate: {
      cart: { id: string; checkoutUrl: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }
  const data = await graphql<CartCreateResult>(
    'storefront',
    /* GraphQL */ `
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart { id checkoutUrl }
          userErrors { field message }
        }
      }
    `,
    {
      input: {
        lines: [
          {
            merchandiseId: opts.variantId,
            quantity: 1,
            attributes: [
              { key: '_book_id', value: opts.bookId },
              { key: 'Book', value: opts.bookTitle },
            ],
          },
        ],
      },
    },
  );
  const { cart, userErrors } = data.cartCreate;
  if (!cart || userErrors.length > 0) {
    throw new Error(`cartCreate failed: ${JSON.stringify(userErrors)}`);
  }
  return { checkoutUrl: cart.checkoutUrl, cartId: cart.id };
}

/* ----------------------------------------------------------------- cart -----
 * Persistent Storefront cart. Each personalized book is one line (qty 1),
 * distinguished by a hidden `_book_id` attribute so multiple books of the
 * same format live as separate lines. The cart id is held in a cookie by the
 * /api/cart routes; these helpers just talk to Shopify.
 */

export interface CartLine {
  id: string;
  quantity: number;
  bookId: string | null;
  variantTitle: string;
  productTitle: string;
  price: { amount: string; currencyCode: string };
}

export interface CartContents {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  subtotal: { amount: string; currencyCode: string };
  lines: CartLine[];
}

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartParts on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 30) {
      nodes {
        id
        quantity
        attributes { key value }
        merchandise {
          ... on ProductVariant {
            title
            price { amount currencyCode }
            product { title }
          }
        }
      }
    }
  }
`;

interface RawCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: { amount: string; currencyCode: string } };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      attributes: { key: string; value: string | null }[];
      merchandise: { title: string; price: { amount: string; currencyCode: string }; product: { title: string } };
    }[];
  };
}

function normalizeCart(cart: RawCart): CartContents {
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    subtotal: cart.cost.subtotalAmount,
    lines: cart.lines.nodes.map((n) => ({
      id: n.id,
      quantity: n.quantity,
      bookId: n.attributes.find((a) => a.key === "_book_id")?.value ?? null,
      variantTitle: n.merchandise.title,
      productTitle: n.merchandise.product.title,
      price: n.merchandise.price,
    })),
  };
}

/** Add a book to the cart, creating the cart if `cartId` is null/expired. */
export async function cartAddBook(opts: {
  cartId: string | null;
  variantId: string;
  bookId: string;
  bookTitle: string;
}): Promise<CartContents> {
  const lineInput = {
    merchandiseId: opts.variantId,
    quantity: 1,
    attributes: [
      { key: "_book_id", value: opts.bookId },
      { key: "Book", value: opts.bookTitle },
    ],
  };

  type CartWarning = { code: string; message: string };
  const guardLineAdded = (cart: RawCart | null, warnings: CartWarning[], prevQty: number) => {
    // Shopify silently drops a line (creating an empty cart) when the variant
    // is out of stock or not published to this Storefront's sales channel —
    // surface that instead of returning a mysteriously empty cart.
    if (cart && cart.totalQuantity <= prevQty) {
      const why = warnings[0]?.message ?? "the product isn't available on the storefront";
      throw new Error(`Couldn't add the book to the cart — ${why}`);
    }
  };

  if (opts.cartId) {
    interface AddResult {
      cartLinesAdd: { cart: RawCart | null; userErrors: { message: string }[]; warnings: CartWarning[] };
    }
    const prev = (await cartFetch(opts.cartId))?.totalQuantity ?? 0;
    const data = await graphql<AddResult>(
      "storefront",
      /* GraphQL */ `
        ${CART_FRAGMENT}
        mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart { ...CartParts }
            userErrors { message }
            warnings { code message }
          }
        }
      `,
      { cartId: opts.cartId, lines: [lineInput] },
    );
    // If the stored cart expired, cart comes back null — fall through to create.
    if (data.cartLinesAdd.cart) {
      guardLineAdded(data.cartLinesAdd.cart, data.cartLinesAdd.warnings, prev);
      return normalizeCart(data.cartLinesAdd.cart);
    }
  }

  interface CreateResult {
    cartCreate: { cart: RawCart | null; userErrors: { message: string }[]; warnings: CartWarning[] };
  }
  const data = await graphql<CreateResult>(
    "storefront",
    /* GraphQL */ `
      ${CART_FRAGMENT}
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart { ...CartParts }
          userErrors { message }
          warnings { code message }
        }
      }
    `,
    { input: { lines: [lineInput] } },
  );
  if (!data.cartCreate.cart) {
    throw new Error(`cartCreate failed: ${JSON.stringify(data.cartCreate.userErrors)}`);
  }
  guardLineAdded(data.cartCreate.cart, data.cartCreate.warnings, 0);
  return normalizeCart(data.cartCreate.cart);
}

/** Fetch cart contents; returns null if the cart no longer exists/expired. */
export async function cartFetch(cartId: string): Promise<CartContents | null> {
  interface CartResult {
    cart: RawCart | null;
  }
  const data = await graphql<CartResult>(
    "storefront",
    /* GraphQL */ `
      ${CART_FRAGMENT}
      query Cart($id: ID!) {
        cart(id: $id) { ...CartParts }
      }
    `,
    { id: cartId },
  );
  return data.cart ? normalizeCart(data.cart) : null;
}

/** Remove a line from the cart. */
export async function cartRemoveLine(cartId: string, lineId: string): Promise<CartContents | null> {
  interface RemoveResult {
    cartLinesRemove: { cart: RawCart | null; userErrors: { message: string }[] };
  }
  const data = await graphql<RemoveResult>(
    "storefront",
    /* GraphQL */ `
      ${CART_FRAGMENT}
      mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart { ...CartParts }
          userErrors { message }
        }
      }
    `,
    { cartId, lineIds: [lineId] },
  );
  return data.cartLinesRemove.cart ? normalizeCart(data.cartLinesRemove.cart) : null;
}

/** Verify X-Shopify-Hmac-Sha256 against the raw request body. */
export function verifyWebhookHmac(rawBody: string | Buffer, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) throw new Error('SHOPIFY_WEBHOOK_SECRET / SHOPIFY_CLIENT_SECRET not configured');
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

/** Extract `_book_id` line item properties from an orders/* webhook payload. */
export function bookIdsFromOrderPayload(order: {
  line_items?: { properties?: { name: string; value: string }[] }[];
}): string[] {
  const ids: string[] = [];
  for (const li of order.line_items ?? []) {
    const prop = (li.properties ?? []).find((p) => p.name === '_book_id');
    if (prop?.value) ids.push(prop.value);
  }
  return ids;
}

/** Create a fulfillment with tracking for the order's open fulfillment order. */
export async function fulfillOrderWithTracking(opts: {
  orderId: number;
  trackingNumber: string;
  trackingUrl?: string;
  carrier?: string;
}): Promise<void> {
  interface FulfillmentOrdersResult {
    order: {
      fulfillmentOrders: { nodes: { id: string; status: string }[] };
    } | null;
  }
  const data = await graphql<FulfillmentOrdersResult>(
    'admin',
    /* GraphQL */ `
      query FulfillmentOrders($id: ID!) {
        order(id: $id) {
          fulfillmentOrders(first: 5) { nodes { id status } }
        }
      }
    `,
    { id: `gid://shopify/Order/${opts.orderId}` },
  );
  const open = data.order?.fulfillmentOrders.nodes.find((n) => n.status === 'OPEN' || n.status === 'IN_PROGRESS');
  if (!open) throw new Error(`No open fulfillment order for order ${opts.orderId}`);

  interface FulfillmentCreateResult {
    fulfillmentCreate: {
      fulfillment: { id: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }
  const result = await graphql<FulfillmentCreateResult>(
    'admin',
    /* GraphQL */ `
      mutation FulfillmentCreate($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment { id }
          userErrors { field message }
        }
      }
    `,
    {
      fulfillment: {
        lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: open.id }],
        trackingInfo: {
          number: opts.trackingNumber,
          url: opts.trackingUrl,
          company: opts.carrier ?? 'Other',
        },
        notifyCustomer: true,
      },
    },
  );
  const errs = result.fulfillmentCreate.userErrors;
  if (errs.length > 0) throw new Error(`fulfillmentCreate failed: ${JSON.stringify(errs)}`);
}
