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
  }, [book, t]);

  const createHref = suggestedTemplateId
    ? `/create?template=${encodeURIComponent(suggestedTemplateId)}`
    : "/create";

  const cast = book.people.filter((p) => p.photoUrls[0] || p.characterSheetUrl);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      {/* Left — the book, as big as the column allows */}
      <div className="min-w-0">
        <Flipbook book={book} pages={pages} index={pageIndex} onIndexChange={setPageIndex} />
      </div>

      {/* Right — sticky rail: cast transformation + make-your-own CTA */}
      <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
        {cast.length > 0 ? (
          <section className="rounded-3xl bg-white/70 p-6 shadow-fuzzy ring-1 ring-ink/5">
            <h2 className="font-display text-lg font-extrabold text-ink">{t("castTitle")}</h2>
            <p className="mt-1.5 text-sm text-ink-soft">{t("castBody")}</p>
            <div className="mt-5 flex flex-col gap-5">
              {cast.map((person) => (
                <div key={person.id}>
                  <div className="flex items-center gap-3">
                    <figure className="flex-shrink-0 text-center">
                      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-lavender">
                        {person.photoUrls[0] ? (
                          <ProgressiveImage
                            src={person.photoUrls[0]}
                            alt={t("photoAlt", { name: person.name })}
                            className="h-full w-full"
                            imgClassName="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <figcaption className="mt-1 text-[0.6rem] font-semibold uppercase tracking-wide text-ink/40">
                        {t("theirPhoto")}
                      </figcaption>
                    </figure>

                    <span
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-coral/15 text-sm text-coral"
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
                      <figcaption className="mt-1 text-[0.6rem] font-semibold uppercase tracking-wide text-ink/40">
                        {t("characterSheet")}
                      </figcaption>
                    </figure>
                  </div>
                  <p className="mt-1.5 text-center font-display text-sm font-bold text-ink">
                    {person.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl bg-white p-6 text-center shadow-fuzzy ring-1 ring-ink/5">
          <p className="font-display text-lg font-extrabold text-ink">{t("ctaTitle")}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {suggestedTemplateId ? t("ctaBodyTemplate") : t("ctaBodyDefault")}
          </p>
          <ButtonLink href={createHref} size="lg" className="mt-4 w-full">
            {t("ctaButton")}
          </ButtonLink>
        </section>
      </aside>
    </div>
  );
}
