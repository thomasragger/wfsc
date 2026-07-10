import { ImageResponse } from "next/og";

import { BOOK_OG_SIZE, bookShareCard } from "@/lib/book-og-card";
import { fetchBookBundle } from "@/lib/books";

/**
 * Generative share card for a customer's book: when they send their private
 * link to family (the core sharing moment), the preview shows THEIR cover and
 * title instead of a generic brand card. Reachable only with the book token,
 * same capability as the page itself; the cover is fetched via a signed URL.
 */
export const alt = "A personalized Warm Fuzzy Story Club book";
export const size = BOOK_OG_SIZE;
export const contentType = "image/png";

export default async function BookOgImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bundle = await fetchBookBundle(token).catch(() => null);
  const payload = bundle?.payload;
  const de = bundle?.book.locale === "de";

  return new ImageResponse(
    bookShareCard({
      title: payload?.title ?? (de ? "Ein Bilderbuch nur für uns" : "A storybook just for us"),
      coverSrc: payload?.coverImageUrl ?? null,
      eyebrow: "Warm Fuzzy Story Club",
      message: de
        ? "Ein einzigartiges Bilderbuch aus einer echten Familienerinnerung, mit den Menschen, die wir lieben."
        : "A one-of-a-kind picture book made from a real family memory, starring the people we love.",
      pill: de ? "Wirf einen Blick hinein" : "Come take a peek",
    }),
    size,
  );
}
