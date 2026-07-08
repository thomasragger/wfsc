/**
 * Transactional email via Resend's REST API (no SDK). Degrades to console
 * logging when RESEND_API_KEY is unset so dev/preview environments never
 * crash on missing config.
 */
const FROM = process.env.EMAIL_FROM ?? 'Warm Fuzzy Story Club <hello@warmfuzzystoryclub.com>';

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
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

const studioUrl = () => process.env.STUDIO_URL ?? 'https://wfsc-studio.vercel.app';

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
    <a href="${link}" style="display: inline-block; background: #ff4315; color: #ffffff; font-weight: 700; padding: 14px 34px; border-radius: 999px; text-decoration: none;">
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
    <a href="${link}" style="display: inline-block; background: #ff4315; color: #ffffff; font-weight: 700; padding: 14px 34px; border-radius: 999px; text-decoration: none;">
      See your preview
    </a>
  </div>
</div>`,
  };
}
