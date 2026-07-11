import { NextResponse } from "next/server";

import {
  ADMIN_COOKIE,
  adminCookieOptions,
  isAdminEnabled,
  mintCookieValue,
  verifyPassphrase,
} from "@/lib/admin-auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/login — exchange the shared passphrase for a signed session
 * cookie. Fail closed (404) when the admin area is disabled. Strict per-IP
 * rate limit blunts brute force. Constant-time passphrase compare.
 */
export async function POST(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limit = await checkRateLimit("admin-login", getClientIp(request));
  if (!limit.ok) {
    return rateLimitResponse(
      "Too many attempts. Please wait an hour before trying again.",
      limit.retryAfter,
    );
  }

  let passphrase = "";
  try {
    const body = (await request.json()) as { passphrase?: unknown };
    passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
  } catch {
    passphrase = "";
  }

  if (!verifyPassphrase(passphrase)) {
    return NextResponse.json({ error: "Incorrect passphrase." }, { status: 401 });
  }

  const value = mintCookieValue();
  if (!value) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, value, adminCookieOptions());
  return res;
}
