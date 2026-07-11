import { NextResponse } from "next/server";
import { z } from "zod";

import { generateFrontMatterOptions } from "@wfsc/pipeline";

import {
  RATE_LIMIT_COPY,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

const SuggestSchema = z.object({
  kind: z.enum(["title", "dedication"]),
  memoryText: z.string().trim().min(20).max(5000),
  templateTitle: z.string().trim().max(120).nullish(),
  castNames: z.array(z.string().trim().min(1).max(80)).max(4).nullish(),
  targetAge: z.number().int().min(0).max(12).nullish(),
  locale: z.enum(["en", "de"]),
});

/**
 * POST /api/suggest-front-matter — 3 AI-written title or dedication options
 * for the wizard's Finish step, grounded in the memory text and cast names.
 * memoryText is personal data: it goes to the model and nowhere else (never
 * logged, never stored).
 */
export async function POST(request: Request) {
  try {
    const parsed = SuggestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const input = parsed.data;

    // Each request is a paid LLM call: limit per IP (fails open on DB errors).
    const ip = getClientIp(request);
    const limit = await checkRateLimit("suggest-ip", ip);
    if (!limit.ok) {
      return rateLimitResponse(RATE_LIMIT_COPY.suggest, limit.retryAfter);
    }

    const options = await generateFrontMatterOptions({
      kind: input.kind,
      memoryText: input.memoryText,
      templateTitle: input.templateTitle ?? undefined,
      castNames: input.castNames ?? undefined,
      targetAge: input.targetAge ?? undefined,
      language: input.locale === "de" ? "German" : "English",
    });

    return NextResponse.json({ options });
  } catch {
    // Deliberately opaque: no logging here so the personal request payload
    // can never leak into logs; the client shows its own friendly copy.
    return NextResponse.json({ error: "Could not fetch suggestions" }, { status: 500 });
  }
}
