import { NextResponse } from "next/server";

import {
  clearOAuthTransients,
  readOAuthTransients,
  setCustomerToken,
} from "@/lib/customer-session";
import { exchangeCode } from "@/lib/shopify-customer";

export const runtime = "nodejs";

/** GET /account/callback — OAuth redirect target; exchange code → session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  const { state, verifier } = await readOAuthTransients();
  await clearOAuthTransients();

  if (!code || !returnedState || !state || returnedState !== state || !verifier) {
    return NextResponse.redirect(`${origin}/account?error=auth`);
  }

  try {
    const tokens = await exchangeCode({
      code,
      redirectUri: `${origin}/account/callback`,
      verifier,
    });
    await setCustomerToken(tokens.accessToken, tokens.expiresIn);
    return NextResponse.redirect(`${origin}/account`);
  } catch {
    return NextResponse.redirect(`${origin}/account?error=auth`);
  }
}
