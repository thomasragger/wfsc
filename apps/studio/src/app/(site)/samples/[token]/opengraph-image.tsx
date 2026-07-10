import { ImageResponse } from "next/og";

import { BOOK_OG_SIZE, bookShareCard } from "@/lib/book-og-card";
import { fetchSampleBundle } from "@/lib/samples";

/** Generative share card for a sample book: its real cover + title. */
export const alt = "A sample Warm Fuzzy Story Club book";
export const size = BOOK_OG_SIZE;
export const contentType = "image/png";

export default async function SampleOgImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bundle = await fetchSampleBundle(token).catch(() => null);
  const payload = bundle?.payload;
  const styleName = payload?.style?.name;

  return new ImageResponse(
    bookShareCard({
      title: payload?.title ?? "A sample storybook",
      coverSrc: payload?.coverImageUrl ?? null,
      eyebrow: "Warm Fuzzy Story Club",
      message: styleName
        ? `A finished sample book, illustrated in the ${styleName} style. Flip through every page.`
        : "A finished sample book. Flip through every page.",
      pill: "Make one starring your family",
    }),
    size,
  );
}
