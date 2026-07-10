/**
 * Cloudflare Turnstile server-side verification (workstream O5).
 *
 * The wizard's Finish step renders a Turnstile widget and submits the resulting
 * token in the `POST /api/books` body; this helper verifies it against
 * Cloudflare's siteverify endpoint.
 *
 * Degradation: when `TURNSTILE_SECRET_KEY` is unset (local dev) verification is
 * skipped with a console warning. When the secret IS set, verification is
 * enforced: a missing/invalid token is rejected, and a network failure talking
 * to Cloudflare fails closed (returns false) since the challenge could not be
 * confirmed.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let warnedDisabled = false;

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verify a Turnstile token. Returns true when the token is valid, or when
 * Turnstile is not configured (dev). Returns false when configured and the
 * token is missing, invalid, or cannot be verified.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY not set. Skipping human verification. Configure Turnstile to enforce it in production.",
      );
    }
    return true;
  }

  if (!token) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      console.error(`[turnstile] siteverify HTTP ${res.status}`);
      return false;
    }
    const data = (await res.json()) as SiteverifyResponse;
    if (!data.success) {
      console.warn("[turnstile] verification rejected", data["error-codes"]);
    }
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] siteverify request failed", err);
    return false;
  }
}
