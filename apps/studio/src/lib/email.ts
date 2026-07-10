/**
 * Transactional email via Resend's REST API (no SDK). Degrades to console
 * logging when RESEND_API_KEY is unset so dev/preview environments never
 * crash on missing config. In production the boot-time assertion below makes
 * missing config a hard startup failure instead.
 */
const FROM = process.env.EMAIL_FROM ?? 'Warm Fuzzy Story Club <hello@warmfuzzystoryclub.com>';

const IS_PROD = process.env.NODE_ENV === 'production';
// `next build` runs with NODE_ENV=production; don't fail the build for env that
// only needs to exist at runtime. The check runs at server boot (first import).
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Boot-time assertion: in production, email must be fully configured or the
 * process must not come up. Missing RESEND_API_KEY or STUDIO_URL used to fail
 * silently (a console.warn per send / a stale Vercel fallback URL); now it
 * fails loudly at startup. Dev/preview keep degrading gracefully.
 */
function assertEmailEnv(): void {
  if (!IS_PROD || IS_BUILD_PHASE) return;
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!process.env.STUDIO_URL) missing.push('STUDIO_URL');
  if (missing.length > 0) {
    throw new Error(
      `[email] Missing required production environment variable(s): ${missing.join(', ')}. ` +
        'Set them in the deployment environment before starting the app.',
    );
  }
}
assertEmailEnv();

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Only reachable in non-prod: the boot assertion guarantees the key in
    // production. Log and no-op so dev/preview never crash.
    console.warn(`[email skipped: RESEND_API_KEY unset] to=${opts.to} subject="${opts.subject}"`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) throw new Error(`Resend failed ${res.status}: ${await res.text()}`);
}

const studioUrl = (): string => {
  const url = process.env.STUDIO_URL;
  if (url) return url;
  // Prod is guaranteed to have STUDIO_URL by the boot assertion; this throw is
  // a defensive belt-and-braces. Dev falls back to localhost only.
  if (IS_PROD) throw new Error('[email] STUDIO_URL is required in production');
  return 'http://localhost:3000';
};

/** "Your book is ready to review" — sent when the full book finishes generating. */
export function reviewReadyEmail(book: { title: string | null; access_token: string }): {
  subject: string;
  html: string;
} {
  const link = `${studioUrl()}/book/${book.access_token}`;
  const title = book.title ?? 'Your storybook';
  return {
    subject: `✨ ${title} is ready for you`,
    html: `
<div style="font-family: Quicksand, 'Helvetica Neue', sans-serif; background: #fffaf7; padding: 40px 24px; color: #761e0b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 40px 32px; text-align: center;">
    <img src="${studioUrl()}/logo.png" alt="Warm Fuzzy Story Club" width="120" style="margin-bottom: 24px;"/>
    <h1 style="font-size: 26px; margin: 0 0 12px;">Your book is ready! 🎉</h1>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
      <strong>${title}</strong> has been fully illustrated.
      Take a look, fine-tune the dedication, fonts and layouts if you like,
      and approve it for printing.
    </p>
    <a href="${link}" style="display: inline-block; background: #ff7916; color: #ffffff; font-weight: 700; padding: 14px 34px; border-radius: 999px; text-decoration: none;">
      Review your book
    </a>
    <p style="font-size: 13px; color: #a58f85; margin-top: 28px;">
      This link is private to you — anyone with it can view your book.
    </p>
  </div>
</div>`,
  };
}

/** "Your book went to print" — sent after the print job is submitted. */
export function printSubmittedEmail(book: { title: string | null }): {
  subject: string;
  html: string;
} {
  const title = book.title ?? 'Your storybook';
  return {
    subject: `📚 ${title} is off to the printer`,
    html: `
<div style="font-family: Quicksand, 'Helvetica Neue', sans-serif; background: #fffaf7; padding: 40px 24px; color: #761e0b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 40px 32px; text-align: center;">
    <img src="${studioUrl()}/logo.png" alt="Warm Fuzzy Story Club" width="120" style="margin-bottom: 24px;"/>
    <h1 style="font-size: 26px; margin: 0 0 12px;">Off to the printer! 🖨️</h1>
    <p style="font-size: 16px; line-height: 1.6;">
      <strong>${title}</strong> has been sent to print. We'll email you tracking
      details the moment it ships. Printing usually takes 3–5 business days.
    </p>
  </div>
</div>`,
  };
}

/** "Your book is taking a little longer" — sent when full generation fails
 *  after payment and ops has to step in. Honest, no fake ETA. */
export function generationDelayedEmail(book: { title: string | null }): {
  subject: string;
  html: string;
} {
  const title = book.title ?? 'Your storybook';
  return {
    subject: `${title} is taking a little longer`,
    html: `
<div style="font-family: Quicksand, 'Helvetica Neue', sans-serif; background: #fffaf7; padding: 40px 24px; color: #761e0b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 40px 32px; text-align: center;">
    <img src="${studioUrl()}/logo.png" alt="Warm Fuzzy Story Club" width="120" style="margin-bottom: 24px;"/>
    <h1 style="font-size: 26px; margin: 0 0 12px;">A small hiccup 🎨</h1>
    <p style="font-size: 16px; line-height: 1.6;">
      <strong>${title}</strong> is taking a little longer to illustrate than usual.
      Our team is already on it — you don't need to do anything, and we'll email
      you the moment it's ready for your review.
    </p>
    <p style="font-size: 13px; color: #a58f85; margin-top: 28px;">
      Questions? Just reply to this email.
    </p>
  </div>
</div>`,
  };
}

/** "Your preview is ready" — sent when the free preview finishes generating. */
export function previewReadyEmail(book: { title: string | null; access_token: string }): {
  subject: string;
  html: string;
} {
  const link = `${studioUrl()}/book/${book.access_token}`;
  const title = book.title ?? 'Your storybook';
  return {
    subject: `✨ Your preview of ${title} is ready`,
    html: `
<div style="font-family: Quicksand, 'Helvetica Neue', sans-serif; background: #fffaf7; padding: 40px 24px; color: #761e0b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 40px 32px; text-align: center;">
    <img src="${studioUrl()}/logo.png" alt="Warm Fuzzy Story Club" width="120" style="margin-bottom: 24px;"/>
    <h1 style="font-size: 26px; margin: 0 0 12px;">Come take a peek! ✨</h1>
    <p style="font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
      The first pages of <strong>${title}</strong> are illustrated and waiting for you.
      Your private link never expires — come back anytime.
    </p>
    <a href="${link}" style="display: inline-block; background: #ff7916; color: #ffffff; font-weight: 700; padding: 14px 34px; border-radius: 999px; text-decoration: none;">
      See your preview
    </a>
  </div>
</div>`,
  };
}
