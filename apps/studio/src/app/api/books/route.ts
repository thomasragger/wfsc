import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveLocale } from "@/i18n/request";
import { inngest } from "@/inngest/client";
import { PERSON_ROLES, type PersonRole } from "@/lib/book-payload";
import { previewSpendTodayUsd } from "@/lib/generation-jobs";
import { opsAlert } from "@/lib/ops-alert";
import {
  RATE_LIMIT_COPY,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { UPLOADS_BUCKET, canonicalStorageUrl, parseStorageUrl } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const CreateBookSchema = z.object({
  memoryText: z.string().trim().min(20, "Tell us a little more about your memory").max(5000),
  title: z.string().trim().max(120).nullish(),
  greeting: z.string().trim().max(600).nullish(),
  greetingFrom: z.string().trim().max(80).nullish(),
  targetAge: z.number().int().min(0).max(12).nullish(),
  templateId: z.string().trim().max(100).optional(),
  styleId: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  // Cloudflare Turnstile token from the wizard Finish step. Optional in the
  // schema so dev (no Turnstile configured) works; enforced below when set.
  turnstileToken: z.string().max(4000).nullish(),
  people: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        role: z.enum(PERSON_ROLES as [PersonRole, ...PersonRole[]]),
        photoUrls: z.array(z.string().url()).min(1).max(3),
      }),
    )
    .min(1)
    .max(4),
});

// Per-instance dedupe so a traffic spike against a reached budget doesn't
// email ops on every request (cold starts may re-alert; that's fine).
let budgetAlertedOn: string | null = null;

/**
 * POST /api/books — create a book from the intake wizard, kick off preview
 * generation, and return the access token the customer uses from here on.
 */
export async function POST(request: Request) {
  try {
    const parsed = CreateBookSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // Abuse control: rate limit per IP and per email before any paid work.
    const ip = getClientIp(request);
    const ipLimit = await checkRateLimit("books-ip", ip);
    if (!ipLimit.ok) {
      return rateLimitResponse(RATE_LIMIT_COPY.books, ipLimit.retryAfter);
    }
    const emailKey = input.email.trim().toLowerCase();
    const emailLimit = await checkRateLimit("books-email", emailKey);
    if (!emailLimit.ok) {
      return rateLimitResponse(RATE_LIMIT_COPY.books, emailLimit.retryAfter);
    }

    // Human verification (Cloudflare Turnstile). Skipped in dev when unset.
    if (!(await verifyTurnstile(input.turnstileToken, ip))) {
      return NextResponse.json(
        { error: "We couldn't confirm you're human. Please refresh the page and try again." },
        { status: 400 },
      );
    }

    // Free previews cost real money (story + character sheets + images).
    // A daily budget caps the worst case; 0 disables the guard.
    const dailyBudget = Number(process.env.PREVIEW_DAILY_BUDGET_USD ?? 50);
    if (dailyBudget > 0) {
      const spent = await previewSpendTodayUsd();
      if (spent >= dailyBudget) {
        const today = new Date().toISOString().slice(0, 10);
        if (budgetAlertedOn !== today) {
          budgetAlertedOn = today;
          await opsAlert(
            "Preview budget reached — new previews paused",
            `Estimated preview spend today: $${spent.toFixed(2)} >= budget $${dailyBudget}.\nRaise PREVIEW_DAILY_BUDGET_USD if this is genuine demand.`,
          );
        }
        return NextResponse.json(
          {
            error:
              "We're getting a lot of love right now and our illustrators are at capacity. Please try again in a few hours — your story will be worth it!",
          },
          { status: 503 },
        );
      }
    }

    // Photos must live in our private uploads bucket (the wizard uploads them
    // there and passes back signed URLs). Store the canonical unsigned form;
    // reject anything else so external URLs never reach the image pipeline.
    const people: { name: string; role: PersonRole; photoUrls: string[] }[] = [];
    for (const person of input.people) {
      const photoUrls: string[] = [];
      for (const url of person.photoUrls) {
        const ref = parseStorageUrl(url);
        if (!ref || ref.bucket !== UPLOADS_BUCKET) {
          return NextResponse.json(
            { error: "One of the photos couldn't be verified — please re-upload it" },
            { status: 400 },
          );
        }
        photoUrls.push(canonicalStorageUrl(ref.bucket, ref.path));
      }
      people.push({ name: person.name, role: person.role, photoUrls });
    }

    const db = supabaseAdmin();

    const { data: book, error: bookError } = await db
      .from("books")
      .insert({
        email: input.email,
        locale: await resolveLocale(), // story + book language
        title: input.title || null,
        greeting: input.greeting || null,
        greeting_from: input.greetingFrom || null,
        target_age: input.targetAge ?? null,
        memory_text: input.memoryText,
        template_id: input.templateId || null,
        style_id: input.styleId,
        status: "preview_generating",
      })
      .select("id, access_token")
      .single();
    if (bookError || !book) {
      throw new Error(bookError?.message ?? "Could not create the book");
    }

    const { error: peopleError } = await db.from("book_people").insert(
      people.map((p, i) => ({
        book_id: book.id,
        name: p.name,
        role: p.role,
        photo_urls: p.photoUrls,
        sort_order: i,
      })),
    );
    if (peopleError) throw new Error(peopleError.message);

    // Kick off the preview pipeline. In local dev without Inngest configured
    // this may fail; the book still exists and can be retried by ops.
    try {
      await inngest.send({ name: "book/preview.requested", data: { bookId: book.id } });
    } catch (err) {
      console.error("inngest send failed for book/preview.requested", err);
    }

    return NextResponse.json({ token: book.access_token as string }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create the book" },
      { status: 500 },
    );
  }
}
