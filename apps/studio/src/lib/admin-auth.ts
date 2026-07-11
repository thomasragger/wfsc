import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Internal admin area authentication (M-admin). Server-only.
 *
 * A single shared passphrase (ADMIN_SECRET) gates the founder's tools. There is
 * no user table: proving knowledge of the secret mints a signed, httpOnly
 * session cookie. The cookie payload is `<expiryMs>.<issuedMs>.<hmac>` where the
 * HMAC is keyed by the secret itself, so a valid cookie is unforgeable without
 * the secret and rotating the secret invalidates every outstanding session.
 *
 * Fail closed: when ADMIN_SECRET is unset the whole area is disabled (callers
 * treat this as a 404), in dev as well as prod.
 */

export const ADMIN_COOKIE = "wfsc_admin";

/** Session lifetime. */
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

/** The configured secret, or null when the admin area is disabled. */
export function adminSecret(): string | null {
  const s = process.env.ADMIN_SECRET;
  return s && s.length > 0 ? s : null;
}

/** True when the admin area is enabled at all. Everything 404s when false. */
export function isAdminEnabled(): boolean {
  return adminSecret() !== null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time string compare that also hides length differences. */
function safeEqual(a: string, b: string): boolean {
  // Hash both sides to equal-length digests so timingSafeEqual never throws on
  // a length mismatch (which would itself leak length).
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Constant-time check of a submitted passphrase against ADMIN_SECRET. */
export function verifyPassphrase(candidate: string): boolean {
  const secret = adminSecret();
  if (!secret) return false;
  return safeEqual(candidate, secret);
}

/** Mint the signed cookie value for a fresh session. */
export function mintCookieValue(): string | null {
  const secret = adminSecret();
  if (!secret) return null;
  const issued = Date.now();
  const expiry = issued + SESSION_MS;
  const body = `${expiry}.${issued}`;
  return `${body}.${sign(body, secret)}`;
}

export interface AdminSession {
  issuedAt: number;
  expiresAt: number;
}

/**
 * Verify a cookie value: correct HMAC (constant-time) and not expired. Returns
 * the decoded session on success, null otherwise.
 */
export function verifyCookieValue(value: string | undefined | null): AdminSession | null {
  const secret = adminSecret();
  if (!secret || !value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [expStr, iatStr, sig] = parts;
  const body = `${expStr}.${iatStr}`;
  if (!safeEqual(sig, sign(body, secret))) return null;
  const expiresAt = Number(expStr);
  const issuedAt = Number(iatStr);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(issuedAt)) return null;
  if (Date.now() >= expiresAt) return null;
  return { issuedAt, expiresAt };
}

/** Read + verify the admin cookie from the incoming request. */
export async function readAdminSession(): Promise<AdminSession | null> {
  try {
    const value = (await cookies()).get(ADMIN_COOKIE)?.value;
    return verifyCookieValue(value);
  } catch {
    return null;
  }
}

/** Convenience boolean for page/layout gating. */
export async function isAuthed(): Promise<boolean> {
  return (await readAdminSession()) !== null;
}

/**
 * Freshness gate for destructive actions. A valid session is already bounded by
 * the 7-day expiry; deletions additionally re-verify the cookie here so a
 * mutation always re-proves the HMAC on the request that performs it.
 */
export async function requireFreshAdmin(): Promise<boolean> {
  return (await readAdminSession()) !== null;
}

/** httpOnly cookie options shared by the login/logout routes. */
export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_MS / 1000),
  };
}
