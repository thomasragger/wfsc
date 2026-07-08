import type { FontPairingId, LayoutId } from "@wfsc/book-engine";

import type { BookFormat, BookPayload, PersonRole } from "@/lib/book-payload";

/** Thin typed fetch helpers for the Studio API, used by client components. */

export interface StyleSummary {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
}

export interface TemplateSummary {
  id: string;
  categoryId: string;
  categoryName?: string | null;
  title: string;
  tagline: string | null;
  description: string | null;
  suggestedStyleId: string | null;
  storyBeats: string[];
  exampleImageUrl: string | null;
}

export interface CategorySummary {
  id: string;
  name: string;
  tagline: string | null;
}

export interface CreateBookInput {
  memoryText: string;
  title?: string;
  templateId?: string;
  styleId: string;
  email: string;
  people: { name: string; role: PersonRole; photoUrls: string[] }[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  return json;
}

export async function getStyles(): Promise<StyleSummary[]> {
  const { styles } = await request<{ styles: StyleSummary[] }>("/api/styles");
  return styles;
}

export async function getTemplate(id: string): Promise<TemplateSummary> {
  const { template } = await request<{ template: TemplateSummary }>(
    `/api/templates?id=${encodeURIComponent(id)}`,
  );
  return template;
}

export async function getCategoryTemplates(
  categoryId: string,
): Promise<{ category: CategorySummary; templates: TemplateSummary[] }> {
  return request<{ category: CategorySummary; templates: TemplateSummary[] }>(
    `/api/templates?category=${encodeURIComponent(categoryId)}`,
  );
}

export async function uploadPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
  return json.url;
}

export async function createBook(input: CreateBookInput): Promise<string> {
  const { token } = await request<{ token: string }>("/api/books", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return token;
}

export async function getBook(token: string): Promise<BookPayload> {
  const { book } = await request<{ book: BookPayload }>(
    `/api/books/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  return book;
}

export async function patchBook(
  token: string,
  fields: { greeting?: string | null; fontPairing?: FontPairingId; title?: string },
): Promise<void> {
  await request(`/api/books/${encodeURIComponent(token)}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function patchSpread(
  token: string,
  spreadId: string,
  fields: { text?: string; layout?: LayoutId },
): Promise<void> {
  await request(
    `/api/books/${encodeURIComponent(token)}/spreads/${encodeURIComponent(spreadId)}`,
    { method: "PATCH", body: JSON.stringify(fields) },
  );
}

export async function regenerateSpread(
  token: string,
  spreadId: string,
  note: string,
): Promise<void> {
  await request(
    `/api/books/${encodeURIComponent(token)}/spreads/${encodeURIComponent(spreadId)}/regenerate`,
    { method: "POST", body: JSON.stringify({ note }) },
  );
}

export async function startCheckout(token: string, format: BookFormat): Promise<string> {
  const { checkoutUrl } = await request<{ checkoutUrl: string }>(
    `/api/books/${encodeURIComponent(token)}/checkout`,
    { method: "POST", body: JSON.stringify({ format }) },
  );
  return checkoutUrl;
}

export async function approveBook(token: string): Promise<void> {
  await request(`/api/books/${encodeURIComponent(token)}/approve`, { method: "POST" });
}
