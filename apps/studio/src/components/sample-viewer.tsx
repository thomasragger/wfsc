"use client";

import { useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import { Flipbook, type FlipPage } from "@/components/flipbook";
import { ButtonLink } from "@/components/ui/button";
import { ProgressiveImage } from "@/components/ui/progressive-image";
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
  const t = useTranslations("sampleViewer");
  const [pageIndex, setPageIndex] = useState(0);

  const pages: FlipPage[] = useMemo(() => {
    const greetingSpread = book.spreads.find((s) => s.kind === "greeting");
    const dedication = book.greeting ?? greetingSpread?.text ?? null;
    return [
      { kind: "cover" as const },
      { kind: "title" as const, title: book.title ?? t("defaultTitle"), styleName: book.style?.name ?? null },
      ...(dedication ? [{ kind: "dedication" as const, text: dedication, from: book.greetingFrom }] : []),
      ...book.spreads
        .filter((s) => s.kind !== "cover" && s.kind !== "greeting")
        .map((spread) => ({ kind: "spread" as const, spread })),
    ];
  }, [book]);

  const createHref = suggestedTemplateId
    ? `/create?template=${encodeURIComponent(suggestedTemplateId)}`
    : "/create";

  const cast = book.people.filter((p) => p.photoUrls[0] || p.characterSheetUrl);

  return (
    <div>
      <Flipbook book={book} pages={pages} index={pageIndex} onIndexChange={setPageIndex} />

      {cast.length > 0 ? (
        <section className="mx-auto mt-16 max-w-4xl">
          <div className="text-center">
            <h2 className="font-display text-2xl font-extrabold text-ink">
              {t("castTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              {t("castBody")}
            </p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {cast.map((person) => (
              <div
                key={person.id}
                className="rounded-3xl bg-white/70 p-5 shadow-fuzzy ring-1 ring-ink/5"
              >
                <div className="flex items-center justify-center gap-3 sm:gap-4">
                  <figure className="flex-shrink-0 text-center">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl bg-lavender sm:h-28 sm:w-28">
                      {person.photoUrls[0] ? (
                        <ProgressiveImage
                          src={person.photoUrls[0]}
                          alt={t("photoAlt", { name: person.name })}
                          className="h-full w-full"
                          imgClassName="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <figcaption className="mt-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-ink/40">
                      {t("theirPhoto")}
                    </figcaption>
                  </figure>

                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-coral/15 text-coral"
                    aria-hidden="true"
                  >
                    →
                  </span>

                  <figure className="min-w-0 flex-1 text-center">
                    <div className="aspect-square overflow-hidden rounded-2xl bg-cream">
                      {person.characterSheetUrl ? (
                        <ProgressiveImage
                          src={person.characterSheetUrl}
                          alt={t("characterSheetAlt", { name: person.name })}
                          className="h-full w-full"
                          imgClassName="h-full w-full object-contain"
                        />
                      ) : null}
                    </div>
                    <figcaption className="mt-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-ink/40">
                      {t("characterSheet")}
                    </figcaption>
                  </figure>
                </div>
                <p className="mt-3 text-center font-display font-bold text-ink">
                  {person.name}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mx-auto mt-12 max-w-xl text-center">
        <p className="font-display text-xl font-extrabold text-ink">
          {t("ctaTitle")}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {suggestedTemplateId
            ? t("ctaBodyTemplate")
            : t("ctaBodyDefault")}
        </p>
        <ButtonLink href={createHref} size="lg" className="mt-5">
          {t("ctaButton")}
        </ButtonLink>
      </div>
    </div>
  );
}
