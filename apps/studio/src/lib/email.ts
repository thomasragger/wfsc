/**
 * Transactional email via Resend's REST API (no SDK). Degrades to console
 * logging when RESEND_API_KEY is unset so dev/preview environments never
 * crash on missing config. In production the boot-time assertion below makes
 * missing config a hard startup failure instead.
 *
 * All four customer templates share one table-based, inline-styled layout
 * (emailLayout) built for real email clients: no <style> blocks, no
 * flexbox/grid, no web fonts, max 600px, a bulletproof (padded table cell)
 * button, width + alt on every image, a hidden preheader, and a plain-text
 * part alongside the HTML. Every user-facing string lives in a per-template,
 * locale-keyed copy map so translations (O7) can add a `de` table without
 * touching the render code.
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
  /** Plain-text alternative. Always send one alongside html for deliverability. */
  text?: string;
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
    body: JSON.stringify({
      from: FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
    }),
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

// --- Brand tokens (inline only; no <style> blocks reach email clients) --------
const CREAM = '#fffaf7';
const CARD = '#ffffff';
const INK = '#761e0b';
const CORAL = '#ff7916';
const MUTED = '#a58f85';
const FONT = "'Quicksand','Trebuchet MS',Helvetica,Arial,sans-serif";

/** The rendered pieces every send site hands to Resend. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** The book fields any template may read. Locale drives copy selection. */
export type EmailBook = {
  title: string | null;
  access_token?: string;
  locale?: string | null;
};

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Fill the {title} token in a copy string for HTML (title bolded + escaped). */
function fillHtml(str: string, title: string): string {
  return esc(str).replaceAll('{title}', `<strong>${esc(title)}</strong>`);
}

/** Fill the {title} token for the plain-text part (raw title, no markup). */
function fillText(str: string, title: string): string {
  return str.replaceAll('{title}', title);
}

/** Select the copy table for a book's locale, defaulting to English. */
function pickCopy<T>(map: Record<string, T>, locale: string | null | undefined): T {
  return (locale ? map[locale] : undefined) ?? map.en;
}

/** Localized fallback for a book without a title yet. */
function fallbackTitle(locale: string | null | undefined): string {
  return locale === 'de' ? 'Dein Bilderbuch' : 'Your storybook';
}

// --- Shared layout ------------------------------------------------------------

interface LayoutParts {
  /** Hidden preview text shown in the inbox list. */
  preheader: string;
  /** Mascot accent from /mascots/*.png. */
  mascot: { file: string; alt: string };
  heading: string;
  /** Body paragraphs, already run through fillHtml. */
  paragraphsHtml: string[];
  /** Optional bulletproof call-to-action button. */
  cta?: { label: string; href: string };
  /** Optional muted privacy note (rendered when a book link is present). */
  privacyNote?: string;
  /** Optional muted contact note. */
  contactNote?: string;
  /** Document language for the html tag ('en' | 'de'). */
  lang?: string;
  /** Small brand footer line. */
  footer: string;
}

function emailLayout(parts: LayoutParts): string {
  const logo = `${studioUrl()}/logo.png`;
  const mascotSrc = `${studioUrl()}/mascots/${parts.mascot.file}`;

  const paragraphs = parts.paragraphsHtml
    .map(
      (p) =>
        `<p style="margin: 0 auto 16px; max-width: 460px; font-family: ${FONT}; font-size: 16px; line-height: 1.6; color: ${INK}; text-wrap: pretty;">${p}</p>`,
    )
    .join('\n');

  const button = parts.cta
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 12px auto 4px;">
                <tr>
                  <td align="center" bgcolor="${CORAL}" style="border-radius: 999px;">
                    <a href="${esc(parts.cta.href)}" target="_blank" style="display: inline-block; padding: 15px 40px; font-family: ${FONT}; font-size: 16px; font-weight: 700; line-height: 1; color: #ffffff; text-decoration: none; border-radius: 999px;">${esc(
                      parts.cta.label,
                    )}</a>
                  </td>
                </tr>
              </table>`
    : '';

  const privacy = parts.privacyNote
    ? `<p style="margin: 20px auto 0; max-width: 440px; font-family: ${FONT}; font-size: 13px; line-height: 1.5; color: ${MUTED}; text-wrap: pretty;">${esc(
        parts.privacyNote,
      )}</p>`
    : '';

  const contact = parts.contactNote
    ? `<p style="margin: 20px auto 0; max-width: 440px; font-family: ${FONT}; font-size: 13px; line-height: 1.5; color: ${MUTED}; text-wrap: pretty;">${esc(
        parts.contactNote,
      )}</p>`
    : '';

  return `<!doctype html>
<html lang="${parts.lang === 'de' ? 'de' : 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${esc(parts.heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${CREAM};">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: ${CREAM}; opacity: 0;">${esc(
    parts.preheader,
  )}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${CREAM};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 600px;">
          <tr>
            <td align="center" style="padding: 0 0 20px;">
              <img src="${logo}" alt="Warm Fuzzy Story Club" width="150" style="display: block; width: 150px; max-width: 60%; height: auto; border: 0;">
            </td>
          </tr>
          <tr>
            <td style="background-color: ${CARD}; border-radius: 24px; padding: 40px 36px; text-align: center;">
              <img src="${mascotSrc}" alt="${esc(
                parts.mascot.alt,
              )}" width="144" style="display: block; width: 144px; max-width: 45%; height: auto; margin: 0 auto 22px; border: 0;">
              <h1 style="margin: 0 auto 18px; max-width: 460px; font-family: ${FONT}; font-size: 26px; line-height: 1.3; font-weight: 700; color: ${INK}; text-wrap: balance;">${esc(
                parts.heading,
              )}</h1>
              ${paragraphs}
              ${button}
              ${privacy}
              ${contact}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 16px 8px;">
              <p style="margin: 0; font-family: ${FONT}; font-size: 12px; line-height: 1.5; color: ${MUTED};">${esc(
                parts.footer,
              )}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface TextParts {
  heading: string;
  paragraphsText: string[];
  cta?: { label: string; href: string };
  privacyNote?: string;
  contactNote?: string;
  footer: string;
}

function emailText(parts: TextParts): string {
  const lines: string[] = ['Warm Fuzzy Story Club', '', parts.heading, ''];
  for (const p of parts.paragraphsText) {
    lines.push(p, '');
  }
  if (parts.cta) lines.push(`${parts.cta.label}: ${parts.cta.href}`, '');
  if (parts.privacyNote) lines.push(parts.privacyNote, '');
  if (parts.contactNote) lines.push(parts.contactNote, '');
  lines.push(parts.footer);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// --- Per-template copy maps (locale-keyed; O7 adds `de` alongside `en`) --------

/**
 * Copy for a template that shows a book link (previewReady, reviewReady).
 * Strings may contain the {title} token. `subject`, `heading`, `paragraphs`,
 * `cta`, `privacy` and `footer` are all user-facing and translatable.
 */
export interface LinkEmailCopy {
  subject: string;
  preheader: string;
  /** Alt text for the mascot accent image (localized alongside the copy). */
  mascotAlt: string;
  heading: string;
  paragraphs: string[];
  cta: string;
  privacy: string;
  footer: string;
}

/** Copy for an informational template with no link (printSubmitted, delayed). */
export interface NoticeEmailCopy {
  subject: string;
  preheader: string;
  /** Alt text for the mascot accent image (localized alongside the copy). */
  mascotAlt: string;
  heading: string;
  paragraphs: string[];
  contact?: string;
  footer: string;
}

const FOOTER_EN = 'Warm Fuzzy Story Club. Every family has a story worth keeping.';
const PRIVACY_EN =
  'This link is private to you. Anyone who has it can view your book, so share it with care.';

// German equivalents (O7). du-Form, warm and plain-spoken.
const FOOTER_DE =
  'Warm Fuzzy Story Club. Jede Familie hat eine Geschichte, die es wert ist, bewahrt zu werden.';
const PRIVACY_DE =
  'Dieser Link ist privat und nur für dich. Wer ihn hat, kann dein Buch ansehen, teile ihn also mit Bedacht.';

/** previewReady: the free preview finished generating. */
export const previewReadyCopy: Record<string, LinkEmailCopy> = {
  en: {
    subject: 'Your sneak peek of {title} is ready',
    preheader: 'The first pages are illustrated and waiting for you.',
    mascotAlt: 'Two Warm Fuzzy Story Club friends sharing a storybook',
    heading: 'Come take a peek',
    paragraphs: [
      'The first pages of {title} are illustrated and ready for you to see.',
      'Your private link never expires, so you can come back to it whenever you like.',
    ],
    cta: 'See your preview',
    privacy: PRIVACY_EN,
    footer: FOOTER_EN,
  },
  de: {
    subject: 'Deine Vorschau von {title} ist fertig',
    preheader: 'Die ersten Seiten sind illustriert und warten auf dich.',
    mascotAlt: 'Zwei Freunde vom Warm Fuzzy Story Club, die sich ein Bilderbuch teilen',
    heading: 'Komm, schau mal rein',
    paragraphs: [
      'Die ersten Seiten von {title} sind illustriert und bereit für dich.',
      'Dein privater Link läuft nie ab, du kannst also jederzeit zurückkommen.',
    ],
    cta: 'Vorschau ansehen',
    privacy: PRIVACY_DE,
    footer: FOOTER_DE,
  },
};

/** reviewReady: the full book finished generating. */
export const reviewReadyCopy: Record<string, LinkEmailCopy> = {
  en: {
    subject: '{title} is ready for you to review',
    preheader: 'Your book is fully illustrated. Take a look and approve it for print.',
    mascotAlt: 'A happy family with their finished storybook',
    heading: 'Your book is ready',
    paragraphs: [
      '{title} is fully written and illustrated. Have a read through, and if anything needs a tweak, you can adjust the dedication, fonts, and layouts.',
      'When it looks just right, approve it and we will send it to the printer.',
    ],
    cta: 'Review your book',
    privacy: PRIVACY_EN,
    footer: FOOTER_EN,
  },
  de: {
    subject: '{title} ist fertig für deine Durchsicht',
    preheader: 'Dein Buch ist vollständig illustriert. Sieh es dir an und gib es zum Druck frei.',
    mascotAlt: 'Eine glückliche Familie mit ihrem fertigen Bilderbuch',
    heading: 'Dein Buch ist fertig',
    paragraphs: [
      '{title} ist vollständig geschrieben und illustriert. Lies es in Ruhe durch, und falls etwas noch nicht passt, kannst du Widmung, Schriften und Layouts anpassen.',
      'Wenn alles genau richtig aussieht, gib es frei und wir schicken es in den Druck.',
    ],
    cta: 'Buch durchsehen',
    privacy: PRIVACY_DE,
    footer: FOOTER_DE,
  },
};

/** printSubmitted: the print job has been submitted. */
export const printSubmittedCopy: Record<string, NoticeEmailCopy> = {
  en: {
    subject: '{title} is on its way to the printer',
    preheader: 'Your book is being printed. We will email you when it ships.',
    mascotAlt: 'A little friend setting off on a journey',
    heading: 'Off to the printer',
    paragraphs: [
      '{title} has been sent to print. Printing usually takes 3 to 5 business days.',
      'We will email you tracking details the moment your book ships.',
    ],
    footer: FOOTER_EN,
  },
  de: {
    subject: '{title} ist auf dem Weg in die Druckerei',
    preheader: 'Dein Buch wird gedruckt. Wir melden uns, sobald es verschickt wird.',
    mascotAlt: 'Ein kleiner Freund macht sich auf die Reise',
    heading: 'Ab in den Druck',
    paragraphs: [
      '{title} ist in den Druck gegangen. Der Druck dauert normalerweise 3 bis 5 Werktage.',
      'Sobald dein Buch verschickt wird, schicken wir dir die Sendungsverfolgung per E-Mail.',
    ],
    footer: FOOTER_DE,
  },
};

/** generationDelayed: full generation failed after payment; honest, no ETA. */
export const generationDelayedCopy: Record<string, NoticeEmailCopy> = {
  en: {
    subject: '{title} is taking a little longer',
    preheader: 'Your book needs a bit more time. We are on it; nothing is needed from you.',
    mascotAlt: 'A Warm Fuzzy Story Club friend painting a storybook at an easel',
    heading: 'A little more time',
    paragraphs: [
      '{title} is taking a little longer to illustrate than usual. Our team is already looking into it, and there is nothing you need to do.',
      'We will email you the moment it is ready for your review.',
    ],
    contact: 'Questions in the meantime? Just reply to this email and a real person will help.',
    footer: FOOTER_EN,
  },
  de: {
    subject: '{title} dauert ein bisschen länger',
    preheader: 'Dein Buch braucht noch etwas Zeit. Wir kümmern uns darum, du musst nichts tun.',
    mascotAlt: 'Ein Freund vom Warm Fuzzy Story Club malt ein Bilderbuch an einer Staffelei',
    heading: 'Noch ein bisschen Zeit',
    paragraphs: [
      '{title} braucht beim Illustrieren länger als sonst. Unser Team schaut es sich schon an, und du musst nichts weiter tun.',
      'Wir melden uns per E-Mail, sobald es für deine Durchsicht bereit ist.',
    ],
    contact: 'Fragen in der Zwischenzeit? Antworte einfach auf diese E-Mail, und ein echter Mensch hilft dir.',
    footer: FOOTER_DE,
  },
};

// --- Templates ----------------------------------------------------------------

/** "Your preview is ready": sent when the free preview finishes generating. */
export function previewReadyEmail(book: EmailBook & { access_token: string }): RenderedEmail {
  const copy = pickCopy(previewReadyCopy, book.locale);
  const title = book.title ?? fallbackTitle(book.locale);
  const link = `${studioUrl()}/book/${book.access_token}`;
  const cta = { label: copy.cta, href: link };
  return {
    subject: fillText(copy.subject, title),
    html: emailLayout({
      lang: book.locale ?? 'en',
      preheader: fillText(copy.preheader, title),
      mascot: { file: 'story.png', alt: copy.mascotAlt },
      heading: copy.heading,
      paragraphsHtml: copy.paragraphs.map((p) => fillHtml(p, title)),
      cta,
      privacyNote: copy.privacy,
      footer: copy.footer,
    }),
    text: emailText({
      heading: copy.heading,
      paragraphsText: copy.paragraphs.map((p) => fillText(p, title)),
      cta,
      privacyNote: copy.privacy,
      footer: copy.footer,
    }),
  };
}

/** "Your book is ready to review": sent when the full book finishes generating. */
export function reviewReadyEmail(book: EmailBook & { access_token: string }): RenderedEmail {
  const copy = pickCopy(reviewReadyCopy, book.locale);
  const title = book.title ?? fallbackTitle(book.locale);
  const link = `${studioUrl()}/book/${book.access_token}`;
  const cta = { label: copy.cta, href: link };
  return {
    subject: fillText(copy.subject, title),
    html: emailLayout({
      lang: book.locale ?? 'en',
      preheader: fillText(copy.preheader, title),
      mascot: { file: 'family.png', alt: copy.mascotAlt },
      heading: copy.heading,
      paragraphsHtml: copy.paragraphs.map((p) => fillHtml(p, title)),
      cta,
      privacyNote: copy.privacy,
      footer: copy.footer,
    }),
    text: emailText({
      heading: copy.heading,
      paragraphsText: copy.paragraphs.map((p) => fillText(p, title)),
      cta,
      privacyNote: copy.privacy,
      footer: copy.footer,
    }),
  };
}

/** "Your book went to print": sent after the print job is submitted. */
export function printSubmittedEmail(book: EmailBook): RenderedEmail {
  const copy = pickCopy(printSubmittedCopy, book.locale);
  const title = book.title ?? fallbackTitle(book.locale);
  return {
    subject: fillText(copy.subject, title),
    html: emailLayout({
      lang: book.locale ?? 'en',
      preheader: fillText(copy.preheader, title),
      mascot: { file: 'travel.png', alt: copy.mascotAlt },
      heading: copy.heading,
      paragraphsHtml: copy.paragraphs.map((p) => fillHtml(p, title)),
      footer: copy.footer,
    }),
    text: emailText({
      heading: copy.heading,
      paragraphsText: copy.paragraphs.map((p) => fillText(p, title)),
      footer: copy.footer,
    }),
  };
}

/** "Your book is taking a little longer": sent when full generation fails
 *  after payment and ops has to step in. Honest, no fake ETA. */
export function generationDelayedEmail(book: EmailBook): RenderedEmail {
  const copy = pickCopy(generationDelayedCopy, book.locale);
  const title = book.title ?? fallbackTitle(book.locale);
  return {
    subject: fillText(copy.subject, title),
    html: emailLayout({
      lang: book.locale ?? 'en',
      preheader: fillText(copy.preheader, title),
      mascot: { file: 'paint.png', alt: copy.mascotAlt },
      heading: copy.heading,
      paragraphsHtml: copy.paragraphs.map((p) => fillHtml(p, title)),
      contactNote: copy.contact,
      footer: copy.footer,
    }),
    text: emailText({
      heading: copy.heading,
      paragraphsText: copy.paragraphs.map((p) => fillText(p, title)),
      contactNote: copy.contact,
      footer: copy.footer,
    }),
  };
}
