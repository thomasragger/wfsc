import { NextResponse } from "next/server";

import { setOAuthTransients } from "@/lib/customer-session";
import { buildAuthorizeUrl, pkcePair, randomState } from "@/lib/shopify-customer";

export const runtime = "nodejs";

/** GET /account/login — start the Customer Account API OAuth (PKCE) flow. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const state = randomState();
  const { verifier, challenge } = pkcePair();
  const authorizeUrl = buildAuthorizeUrl({
    redirectUri: `${origin}/account/callback`,
    state,
    challenge,
  });
  if (!authorizeUrl) {
    // Not configured yet — send them back to the account page's connect state.
    return NextResponse.redirect(`${origin}/account?error=unconfigured`);
  }
  await setOAuthTransients(state, verifier);
  return NextResponse.redirect(authorizeUrl);
}
