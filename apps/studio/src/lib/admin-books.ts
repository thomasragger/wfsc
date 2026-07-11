import type { BookStatus } from "@/lib/book-payload";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Server-only read/aggregate helpers for the internal admin area. All access is
 * via the service-role client; the /admin routes are the only callers and are
 * cookie-gated (see admin-api.ts).
 */

export interface AdminBookRow {
  token: string;
  title: string | null;
  status: BookStatus;
  locale: string | null;
  created_at: string;
  email: string | null;
  is_sample: boolean;
}

const SEARCH_COLUMNS =
  "access_token, title, status, locale, created_at, email, is_sample";

function toRow(r: Record<string, unknown>): AdminBookRow {
  return {
    token: String(r.access_token),
    title: (r.title as string | null) ?? null,
    status: r.status as BookStatus,
    locale: (r.locale as string | null) ?? null,
    created_at: String(r.created_at),
    email: (r.email as string | null) ?? null,
    is_sample: Boolean(r.is_sample),
  };
}

/** Search books by email address (partial, case-insensitive) or exact token. */
export async function adminSearchBooks(query: string): Promise<AdminBookRow[]> {
  const q = query.trim();
  if (!q) return [];
  const db = supabaseAdmin();

  const looksLikeEmail = q.includes("@");
  const req = db.from("books").select(SEARCH_COLUMNS);
  const { data, error } = looksLikeEmail
    ? await req.ilike("email", `%${q}%`).order("created_at", { ascending: false }).limit(100)
    : await req.eq("access_token", q).order("created_at", { ascending: false }).limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toRow(r as Record<string, unknown>));
}

/** Last N books created, newest first. */
export async function adminRecentBooks(limit = 10): Promise<AdminBookRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("books")
    .select(SEARCH_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toRow(r as Record<string, unknown>));
}

/**
 * Counts by status. One query pulls the `status` column for every book and
 * groups in memory — internal volume is small, so this stays a single round
 * trip without needing a dedicated RPC.
 */
export async function adminStatusCounts(): Promise<{ counts: Record<string, number>; total: number }> {
  const { data, error } = await supabaseAdmin().from("books").select("status");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const s = String((row as { status: string }).status);
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return { counts, total: (data ?? []).length };
}

/**
 * Statuses the admin may NOT delete: actively mid-pipeline or already at the
 * printer, where erasing rows would strand an in-flight external job. Mirrors
 * the spirit of the public DELETE rules but narrower — the founder may delete
 * purchased / approved / shipped / cancelled books after a type-the-token
 * confirm. Sample books are never deletable (enforced again in deletion.ts).
 */
export const ADMIN_DELETE_BLOCKED_STATUSES: BookStatus[] = [
  "preview_generating",
  "generating",
  "submitted_to_print",
];

/** Look up a single book by token for a delete decision. */
export async function adminFindBookByToken(
  token: string,
): Promise<{ id: string; status: BookStatus; is_sample: boolean; email: string | null; title: string | null } | null> {
  const { data, error } = await supabaseAdmin()
    .from("books")
    .select("id, status, is_sample, email, title")
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    status: r.status as BookStatus,
    is_sample: Boolean(r.is_sample),
    email: (r.email as string | null) ?? null,
    title: (r.title as string | null) ?? null,
  };
}
