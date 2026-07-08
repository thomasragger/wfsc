"use client";

import { useMemo, useState } from "react";

import { Flipbook, type FlipPage } from "@/components/flipbook";
import { ButtonLink } from "@/components/ui/button";
import type { BookPayload } from "@/lib/book-payload";

/**
 * Read-only page-turning viewer for sample books: the full flipbook,
 * no editing, no checkout — just the story and a "make your own" CTA.
 */
export function SampleViewer({
  book,
  suggestedTemplateId,
}: {
  book: BookPayload;
  suggestedTemplateId: string | null;
}) {
  const [pageIndex, setPageIndex] = useState(0);

  const pages: FlipPage[] = useMemo(() => {
    const greetingSpread = book.spreads.find((s) => s.kind === "greeting");
    const dedication = book.greeting ?? greetingSpread?.text ?? null;
    return [
      { kind: "cover" as const },
      { kind: "title" as const, title: book.title ?? "Your storybook", styleName: book.style?.name ?? null },
      ...(dedication ? [{ kind: "dedication" as const, text: dedication }] : []),
      ...book.spreads
        .filter((s) => s.kind !== "cover" && s.kind !== "greeting")
        .map((spread) => ({ kind: "spread" as const, spread })),
    ];
  }, [book]);

  const createHref = suggestedTemplateId
    ? `/create?template=${encodeURIComponent(suggestedTemplateId)}`
    : "/create";

  return (
    <div>
      <Flipbook book={book} pages={pages} index={pageIndex} onIndexChange={setPageIndex} />

      <div className="mx-auto mt-12 max-w-xl text-center">
        <p className="font-display text-xl font-extrabold text-ink">
          Imagine your family in these pages.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {suggestedTemplateId
            ? "Start from this very story idea and make it entirely yours."
            : "It takes about five minutes to tell us your memory."}
        </p>
        <ButtonLink href={createHref} size="lg" className="mt-5">
          Make your own
        </ButtonLink>
      </div>
    </div>
  );
}
