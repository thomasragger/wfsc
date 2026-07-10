import { requireEnv } from './env.ts';

export const SHOPIFY_API_VERSION = '2026-01';

export interface ShopifyAdmin {
  shop: string;
  gql: <T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>) => Promise<T>;
}

/**
 * Authenticate to the Shopify Admin API via client-credentials grant and return
 * a thin GraphQL caller. Shared by shopify-setup, sync-shopify and shopify-board.
 */
export async function shopifyAdmin(): Promise<ShopifyAdmin> {
  requireEnv('SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET');
  const shop = process.env.SHOPIFY_SHOP_DOMAIN as string;
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Shopify token grant failed (${tokenRes.status}): ${await tokenRes.text()}`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const gql = async <T = Record<string, unknown>>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': access_token },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data as T;
  };

  return { shop, gql };
}
