import { NextResponse } from "next/server";
import { z } from "zod";

import { inngest } from "@/inngest/client";
import { PERSON_ROLES, type PersonRole } from "@/lib/book-payload";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const CreateBookSchema = z.object({
  memoryText: z.string().trim().min(20, "Tell us a little more about your memory").max(5000),
  title: z.string().trim().max(120).optional(),
  templateId: z.string().trim().max(100).optional(),
  styleId: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
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
    const db = supabaseAdmin();

    const { data: book, error: bookError } = await db
      .from("books")
      .insert({
        email: input.email,
        title: input.title || null,
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
      input.people.map((p, i) => ({
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
