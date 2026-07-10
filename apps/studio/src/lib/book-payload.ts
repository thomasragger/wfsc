import type { FontPairingId, LayoutId, SpreadKind } from "@wfsc/book-engine";

/**
 * Client-facing shapes for a book accessed via its access token.
 * Raw database ids for books are intentionally never serialized — everything
 * the customer does is keyed by the token in the URL. Spread and people ids
 * are safe to expose because the API only resolves them inside the token's book.
 */

export type BookStatus =
  | "draft"
  | "preview_generating"
  | "preview_failed"
  | "preview_ready"
  | "purchased"
  | "generating"
  | "generation_failed"
  | "ready_for_review"
  | "approved"
  | "submitted_to_print"
  | "print_failed"
  | "shipped"
  | "cancelled";

export type BookFormat = "board" | "softcover" | "hardcover";

export type PersonRole =
  | "child"
  | "mama"
  | "papa"
  | "grandma"
  | "grandpa"
  | "sibling"
  | "friend"
  | "other";

export const PERSON_ROLES: PersonRole[] = [
  "child",
  "mama",
  "papa",
  "grandma",
  "grandpa",
  "sibling",
  "friend",
  "other",
];

export interface PersonPayload {
  id: string;
  name: string;
  role: string | null;
  photoUrls: string[];
  characterSheetUrl: string | null;
  approved: boolean;
}

export interface SpreadPayload {
  id: string;
  position: number;
  kind: SpreadKind;
  text: string | null;
  layout: LayoutId;
  imageUrl: string | null;
  regenNote: string | null;
}

export interface StylePayload {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
}

export interface BookPayload {
  token: string;
  status: BookStatus;
  /** The book's own content locale (drives printed-page copy like the
   *  dedication signature), independent of the viewer's UI locale. */
  locale: string | null;
  title: string | null;
  greeting: string | null;
  greetingFrom: string | null;
  coverHasTitle: boolean;
  fontPairing: FontPairingId;
  format: BookFormat | null;
  pageCount: number;
  coverImageUrl: string | null;
  approvedAt: string | null;
  createdAt: string;
  people: PersonPayload[];
  spreads: SpreadPayload[];
  style: StylePayload | null;
}

/** Statuses in which the customer may still edit book-level fields. */
export const EDITABLE_BOOK_STATUSES: BookStatus[] = [
  "draft",
  "preview_ready",
  "ready_for_review",
];

/** Statuses in which per-spread text/layout edits are allowed. */
export const EDITABLE_SPREAD_STATUSES: BookStatus[] = [
  "preview_ready",
  "ready_for_review",
];
