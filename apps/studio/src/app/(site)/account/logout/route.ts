import { NextResponse } from "next/server";

import { clearCustomerToken } from "@/lib/customer-session";

export const runtime = "nodejs";

/** GET /account/logout — clear the local session and return home. */
export async function GET(request: Request) {
  await clearCustomerToken();
  return NextResponse.redirect(`${new URL(request.url).origin}/account`);
}
