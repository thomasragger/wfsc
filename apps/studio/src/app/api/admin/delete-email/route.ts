import { NextResponse } from "next/server";

import { guardAdmin } from "@/lib/admin-api";
import { requireFreshAdmin } from "@/lib/admin-auth";
import { bookIdsForEmail, deleteBookData } from "@/lib/deletion";
import { opsAlert } from "@/lib/ops-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/delete-email — erase every NON-SAMPLE book tied to an email
 * (GDPR "delete everything for this person"). bookIdsForEmail already filters
 * out samples; deleteBookData refuses samples as a second backstop. Requires a
 * fresh admin session and a typed-back email confirm.
 */
export async function POST(request: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;
  if (!(await requireFreshAdmin())) {
    return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  }

  let body: { email?: unknown; confirmEmail?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const confirmEmail = typeof body.confirmEmail === "string" ? body.confirmEmail.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  if (confirmEmail.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Confirmation email does not match" }, { status: 400 });
  }

  try {
    const books = await bookIdsForEmail(email);
    const deleted: string[] = [];
    const skipped: { id: string; status: string; reason: string }[] = [];
    for (const b of books) {
      try {
        await deleteBookData(b.id);
        deleted.push(b.id);
      } catch (err) {
        skipped.push({
          id: b.id,
          status: b.status,
          reason: err instanceof Error ? err.message : "unknown",
        });
      }
    }
    console.warn(
      `[admin-audit] bulk delete email=${email} deleted=${deleted.length} skipped=${skipped.length}`,
    );
    await opsAlert(
      "Admin bulk deletion",
      `All non-sample books for ${email} were erased from the admin area.\nDeleted: ${deleted.length}. Skipped: ${skipped.length}.\n${skipped
        .map((s) => `  ${s.id} (${s.status}): ${s.reason}`)
        .join("\n")}`,
    );
    return NextResponse.json({ ok: true, deleted: deleted.length, skipped });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete books" },
      { status: 500 },
    );
  }
}
