import { NextResponse } from "next/server";

import { guardAdmin } from "@/lib/admin-api";
import { adminSearchBooks } from "@/lib/admin-books";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/search — look up books by email address or exact token. */
export async function POST(request: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;

  let query = "";
  try {
    const body = (await request.json()) as { query?: unknown };
    query = typeof body.query === "string" ? body.query : "";
  } catch {
    query = "";
  }
  if (!query.trim()) {
    return NextResponse.json({ error: "Enter an email or token" }, { status: 400 });
  }

  try {
    const rows = await adminSearchBooks(query);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 },
    );
  }
}
