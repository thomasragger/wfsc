import { FONT_PAIRINGS, LAYOUTS, type FontPairingId, type LayoutId, type SpreadKind } from "@wfsc/book-engine";

import type {
  BookFormat,
  BookPayload,
  BookStatus,
  PersonPayload,
  SpreadPayload,
  StylePayload,
} from "@/lib/book-payload";
import { signUrls } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

/** Raw `books` row as read by the service client (server-only). */
export interface BookRow {
  id: string;
  access_token: string;
  email: string | null;
  status: BookStatus;
  title: string | null;
  memory_text: string | null;
  template_id: string | null;
  style_id: string | null;
  format: BookFormat | null;
  font_pairing: string;
  greeting: string | null;
  greeting_from: string | null;
  cover_has_title: boolean | null;
  page_count: number;
  cover_image_url: string | null;
  approved_at: string | null;
  created_at: string;
}

interface PersonRow {
  id: string;
  name: string;
  role: string | null;
  photo_urls: string[] | null;
  character_sheet_url: string | null;
  approved: boolean;
  sort_order: number;
}

interface SpreadRow {
  id: string;
  position: number;
  kind: string;
  text: string | null;
  layout: string;
  image_url: string | null;
  regen_note: string | null;
}

interface StyleRow {
  id: string;
  name: string;
  description: string | null;
  preview_image_url: string | null;
}

export interface BookBundle {
  book: BookRow;
  payload: BookPayload;
}

const BOOK_COLUMNS =
  "id, access_token, email, status, title, memory_text, template_id, style_id, format, font_pairing, greeting, greeting_from, cover_has_title, page_count, cover_image_url, approved_at, created_at";

/**
 * Load a book (with people, spreads, style) by its access token.
 * Returns null when no book matches. Throws when Supabase is not configured.
 */
export async function fetchBookBundle(token: string): Promise<BookBundle | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("books")
    .select(BOOK_COLUMNS)
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const book = data as BookRow;

  const [peopleRes, spreadsRes, styleRes] = await Promise.all([
    db
      .from("book_people")
      .select("id, name, role, photo_urls, character_sheet_url, approved, sort_order")
      .eq("book_id", book.id)
      .order("sort_order", { ascending: true }),
    db
      .from("book_spreads")
      .select("id, position, kind, text, layout, image_url, regen_note")
      .eq("book_id", book.id)
      .order("position", { ascending: true }),
    book.style_id
      ? db
          .from("styles")
          .select("id, name, description, preview_image_url")
          .eq("id", book.style_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const people = (peopleRes.data ?? []) as PersonRow[];
  const spreads = (spreadsRes.data ?? []) as SpreadRow[];
  const style = (styleRes.data ?? null) as StyleRow | null;

  return {
    book,
    payload: await serializeBook(book, people, spreads, style),
  };
}

async function serializeBook(
  book: BookRow,
  people: PersonRow[],
  spreads: SpreadRow[],
  style: StyleRow | null,
): Promise<BookPayload> {
  const fontPairing: FontPairingId =
    book.font_pairing in FONT_PAIRINGS ? (book.font_pairing as FontPairingId) : "storybook";

  // Customer assets live in private buckets; sign everything the client will
  // render in one batch. Order: cover, per-person photos+sheet, spread images.
  const toSign: (string | null)[] = [book.cover_image_url];
  for (const p of people) toSign.push(...(p.photo_urls ?? []), p.character_sheet_url);
  for (const s of spreads) toSign.push(s.image_url);
  const signed = await signUrls(toSign);
  let cursor = 0;
  const next = () => signed[cursor++];

  const coverImageUrl = next();

  const peoplePayload: PersonPayload[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    photoUrls: (p.photo_urls ?? []).map(() => next()).filter((u): u is string => !!u),
    characterSheetUrl: next(),
    approved: p.approved,
  }));

  const spreadsPayload: SpreadPayload[] = spreads.map((s) => ({
    id: s.id,
    position: s.position,
    kind: (s.kind === "cover" || s.kind === "greeting" ? s.kind : "story") as SpreadKind,
    text: s.text,
    layout: (s.layout in LAYOUTS ? s.layout : "text-left") as LayoutId,
    imageUrl: next(),
    regenNote: s.regen_note,
  }));

  const stylePayload: StylePayload | null = style
    ? {
        id: style.id,
        name: style.name,
        description: style.description,
        previewImageUrl: style.preview_image_url,
      }
    : null;

  return {
    token: book.access_token,
    status: book.status,
    title: book.title,
    greeting: book.greeting,
    greetingFrom: book.greeting_from,
    coverHasTitle: book.cover_has_title ?? false,
    fontPairing,
    format: book.format,
    pageCount: book.page_count,
    coverImageUrl,
    approvedAt: book.approved_at,
    createdAt: book.created_at,
    people: peoplePayload,
    spreads: spreadsPayload,
    style: stylePayload,
  };
}
