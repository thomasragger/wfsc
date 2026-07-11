import { NextResponse } from "next/server";

import { guardAdmin } from "@/lib/admin-api";
import {
  generationDelayedEmail,
  previewReadyEmail,
  printSubmittedEmail,
  reviewReadyEmail,
  sendEmail,
  type RenderedEmail,
} from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The email types the panel can send, each with a realistic sample payload. */
export const EMAIL_TYPES = [
  "previewReady",
  "reviewReady",
  "printSubmitted",
  "generationDelayed",
] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

const SAMPLE_TITLE = "The Great Bedtime Adventure";
const SAMPLE_TOKEN = "sample-admin-test-token";

function render(type: EmailType, locale: "en" | "de"): RenderedEmail {
  const linkBook = { title: SAMPLE_TITLE, access_token: SAMPLE_TOKEN, locale };
  const noticeBook = { title: SAMPLE_TITLE, locale };
  switch (type) {
    case "previewReady":
      return previewReadyEmail(linkBook);
    case "reviewReady":
      return reviewReadyEmail(linkBook);
    case "printSubmitted":
      return printSubmittedEmail(noticeBook);
    case "generationDelayed":
      return generationDelayedEmail(noticeBook);
  }
}

/**
 * POST /api/admin/email-test — send any transactional template, in either
 * locale, to an arbitrary recipient, using realistic fake data. Uses the same
 * Resend send path as production.
 */
export async function POST(request: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;

  let body: { type?: unknown; locale?: unknown; to?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const type = body.type as EmailType;
  if (!EMAIL_TYPES.includes(type)) {
    return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
  }
  const locale = body.locale === "de" ? "de" : "en";
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "Enter a valid recipient email" }, { status: 400 });
  }

  try {
    const email = render(type, locale);
    await sendEmail({ to, subject: email.subject, html: email.html, text: email.text });
    return NextResponse.json({ ok: true, subject: email.subject });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 },
    );
  }
}
