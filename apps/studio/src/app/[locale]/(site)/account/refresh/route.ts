import { NextResponse } from "next/server";

import {
  clearCustomerToken,
  getCustomerRefreshToken,
  setCustomerRefreshToken,
  setCustomerToken,
} from "@/lib/customer-session";
import { refreshTokens } from "@/lib/shopify-customer";

export const runtime = "nodejs";

/**
 * GET /account/refresh?next=/account — silent re-login. The account page
 * redirects here when the ~2h access token has expired but the long-lived
 * refresh cookie is still present (server components can't set cookies, so
 * the exchange must happen in a route handler). On failure the session is
 * cleared so the page shows a clean signed-out state instead of a loop.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const nextParam = url.searchParams.get("next") ?? "/account";
  // Only same-site relative paths — never an open redirect.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";

  const refreshToken = await getCustomerRefreshToken();
  if (!refreshToken) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  try {
    const tokens = await refreshTokens(refreshToken);
    await setCustomerToken(tokens.accessToken, tokens.expiresIn);
    // Shopify rotates refresh tokens; store the new one when present.
    if (tokens.refreshToken) await setCustomerRefreshToken(tokens.refreshToken);
  } catch {
    await clearCustomerToken();
  }
  return NextResponse.redirect(`${origin}${next}`);
}
