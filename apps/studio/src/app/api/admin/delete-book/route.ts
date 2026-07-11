import { NextResponse } from "next/server";

import { guardAdmin } from "@/lib/admin-api";
import { ADMIN_DELETE_BLOCKED_STATUSES, adminFindBookByToken } from "@/lib/admin-books";
import { requireFreshAdmin } from "@/lib/admin-auth";
import { deleteBookData } from "@/lib/deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/delete-book — full GDPR erasure of one book, reusing
 * deletion.ts. Requires a fresh admin session and a typed-back token confirm.
 * Never deletes sample books, and refuses statuses that are mid-pipeline / at
 * the printer.
 */
export async function POST(request: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;
  if (!(await requireFreshAdmin())) {
    return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  }

  let body: { token?: unknown; confirmToken?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const confirmToken = typeof body.confirmToken === "string" ? body.confirmToken.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  if (confirmToken !== token) {
    return NextResponse.json({ error: "Confirmation token does not match" }, { status: 400 });
  }

  const book = await adminFindBookByToken(token);
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (book.is_sample) {
    return NextResponse.json(
      { error: "Sample books cannot be deleted from the admin area." },
      { status: 403 },
    );
  }
  if (ADMIN_DELETE_BLOCKED_STATUSES.includes(book.status)) {
    return NextResponse.json(
      {
        error: `Book is "${book.status}" — mid-pipeline or at the printer. Cannot delete until it settles.`,
      },
      { status: 409 },
    );
  }

  try {
    await deleteBookData(book.id);
    // Audit trace (org rule: no em dashes).
    console.warn(
      `[admin-audit] deleted book token=${token} id=${book.id} status=${book.status} email=${book.email ?? "-"}`,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete book" },
      { status: 500 },
    );
  }
}
