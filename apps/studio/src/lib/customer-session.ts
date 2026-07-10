import { cookies } from "next/headers";

/** Cookie helpers for the signed-in customer session + OAuth PKCE transients. */

const TOKEN = "wfsc_customer";
const REFRESH = "wfsc_customer_refresh";
const STATE = "wfsc_oauth_state";
const VERIFIER = "wfsc_oauth_verifier";

/** Refresh tokens outlive the ~2h access token; 30 days matches Shopify's. */
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const secure = process.env.NODE_ENV === "production";

export async function getCustomerToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN)?.value ?? null;
}

export async function setCustomerToken(token: string, maxAgeSeconds: number): Promise<void> {
  (await cookies()).set(TOKEN, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: Math.max(60, maxAgeSeconds),
  });
}

export async function getCustomerRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH)?.value ?? null;
}

export async function setCustomerRefreshToken(token: string): Promise<void> {
  (await cookies()).set(REFRESH, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function clearCustomerToken(): Promise<void> {
  const jar = await cookies();
  jar.delete(TOKEN);
  jar.delete(REFRESH);
}

export async function setOAuthTransients(state: string, verifier: string): Promise<void> {
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: 600 };
  jar.set(STATE, state, opts);
  jar.set(VERIFIER, verifier, opts);
}

export async function readOAuthTransients(): Promise<{ state: string | null; verifier: string | null }> {
  const jar = await cookies();
  return { state: jar.get(STATE)?.value ?? null, verifier: jar.get(VERIFIER)?.value ?? null };
}

export async function clearOAuthTransients(): Promise<void> {
  const jar = await cookies();
  jar.delete(STATE);
  jar.delete(VERIFIER);
}
