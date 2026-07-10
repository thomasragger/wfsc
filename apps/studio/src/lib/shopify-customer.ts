import crypto from "node:crypto";

/**
 * Shopify Customer Account API (new, OAuth 2.0 + PKCE — public client, no
 * secret). Config comes from the Headless channel → Customer Account API:
 *   SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID   — the Client ID
 *   SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID     — the numeric shop id in the endpoints
 * Everything (login, callback, orders) no-ops gracefully until both are set,
 * so the /account page can render a "connect your account" state.
 */

const API_VERSION = "2026-01";

export function customerConfig(): { clientId: string; shopId: string } | null {
  const clientId = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID;
  const shopId = process.env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID;
  if (!clientId || !shopId) return null;
  return { clientId, shopId };
}

export function isCustomerAccountsConfigured(): boolean {
  return customerConfig() !== null;
}

function endpoints(shopId: string) {
  return {
    authorize: `https://shopify.com/authentication/${shopId}/oauth/authorize`,
    token: `https://shopify.com/authentication/${shopId}/oauth/token`,
    logout: `https://shopify.com/authentication/${shopId}/logout`,
    graphql: `https://shopify.com/${shopId}/account/customer/api/${API_VERSION}/graphql`,
  };
}

const b64url = (buf: Buffer) => buf.toString("base64url");

/** PKCE pair — the verifier is stashed in a cookie until the callback. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function randomState(): string {
  return b64url(crypto.randomBytes(16));
}

export function buildAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
  challenge: string;
}): string | null {
  const cfg = customerConfig();
  if (!cfg) return null;
  const url = new URL(endpoints(cfg.shopId).authorize);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("scope", "openid email customer-account-api:full");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface CustomerTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<CustomerTokens> {
  const cfg = customerConfig();
  if (!cfg) throw new Error("Customer accounts not configured");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    redirect_uri: opts.redirectUri,
    code: opts.code,
    code_verifier: opts.verifier,
  });
  const res = await fetch(endpoints(cfg.shopId).token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`token exchange failed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in };
}

/** Exchange a refresh token for a fresh access token (silent re-login). */
export async function refreshTokens(refreshToken: string): Promise<CustomerTokens> {
  const cfg = customerConfig();
  if (!cfg) throw new Error("Customer accounts not configured");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cfg.clientId,
    refresh_token: refreshToken,
  });
  const res = await fetch(endpoints(cfg.shopId).token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`token refresh failed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in };
}

export function logoutUrl(idTokenHint?: string): string | null {
  const cfg = customerConfig();
  if (!cfg) return null;
  const url = new URL(endpoints(cfg.shopId).logout);
  if (idTokenHint) url.searchParams.set("id_token_hint", idTokenHint);
  return url.toString();
}

export interface CustomerProfile {
  firstName: string | null;
  email: string | null;
  orders: {
    id: string;
    name: string;
    processedAt: string | null;
    total: { amount: string; currencyCode: string } | null;
  }[];
}

/** Fetch the signed-in customer's profile + recent orders. */
export async function getCustomerProfile(accessToken: string): Promise<CustomerProfile> {
  const cfg = customerConfig();
  if (!cfg) throw new Error("Customer accounts not configured");
  const query = /* GraphQL */ `
    query {
      customer {
        firstName
        emailAddress { emailAddress }
        orders(first: 25, sortKey: PROCESSED_AT, reverse: true) {
          nodes {
            id
            name
            processedAt
            totalPrice { amount currencyCode }
          }
        }
      }
    }
  `;
  const res = await fetch(endpoints(cfg.shopId).graphql, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: accessToken },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`customer query failed ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      customer?: {
        firstName: string | null;
        emailAddress?: { emailAddress: string | null };
        orders?: { nodes: { id: string; name: string; processedAt: string | null; totalPrice: { amount: string; currencyCode: string } | null }[] };
      };
    };
  };
  const c = json.data?.customer;
  return {
    firstName: c?.firstName ?? null,
    email: c?.emailAddress?.emailAddress ?? null,
    orders: (c?.orders?.nodes ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      processedAt: o.processedAt,
      total: o.totalPrice,
    })),
  };
}
