"use client";

import { useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import { FONT_PAIRINGS } from "@wfsc/book-engine";

import { Flipbook, type FlipPage } from "@/components/flipbook";
import { Button, ButtonLink } from "@/components/ui/button";
import { IconArrowRight } from "@/components/ui/icons";
import { CoverArt } from "@/components/ui/cover-art";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import type { BookPayload } from "@/lib/book-payload";

/**
 * Sample book page: a big cover hero (the reading itself happens in the
 * fullscreen overlay reader), the make-your-own CTA pinned top-right above
 * the fold, and the photo→character transformation cards underneath.
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
  const [readerOpen, setReaderOpen] = useState(false);

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
  const pairing = FONT_PAIRINGS[book.fontPairing];

  return (
    // Fixed-size columns centered as a pair: the cover column is exactly as
    // wide as the cover, so the gap to the CTA card is the gap, not dead space.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,34rem)_20rem] lg:items-start lg:justify-center lg:gap-8">
      {/* Left — one shared content width so the cover and the cast cards
          align edge-to-edge. */}
      <div className="mx-auto w-full max-w-[min(34rem,70vh)] min-w-0 lg:mx-0">
        <CoverArt
          src={book.coverImageUrl}
          alt={book.title ?? t("defaultTitle")}
          title={!book.coverHasTitle ? (book.title ?? t("defaultTitle")) : null}
          titleStyle={{
            fontFamily: `'${pairing.display.family}', sans-serif`,
            fontWeight: pairing.display.weight,
          }}
          pill={t("readBook")}
          onClick={() => setReaderOpen(true)}
          priority
        />

        {/* Cast transformation below the cover, same width as the cover */}
        {cast.length > 0 ? (
          <section className="mt-10 w-full">
            <h2 className="text-center font-display text-2xl font-extrabold text-ink">
              {t("castTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink-soft">{t("castBody")}</p>
            <div className="mt-6 grid gap-5">
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
                      <IconArrowRight className="h-3.5 w-3.5" />
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
                  <p className="mt-3 text-center font-display font-bold text-ink">{person.name}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* Right — sticky CTA, top-aligned with the cover, above the fold */}
      <aside className="lg:sticky lg:top-24">
        <section className="rounded-3xl bg-white p-6 shadow-fuzzy ring-1 ring-ink/5">
          {book.style?.name ? (
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-coral">
              {book.style.name}
            </p>
          ) : null}
          <p className="mt-2 font-display text-xl font-extrabold leading-snug text-ink">
            {t("ctaTitle")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {suggestedTemplateId ? t("ctaBodyTemplate") : t("ctaBodyDefault")}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <ButtonLink href={createHref} size="lg" className="w-full">
              {t("ctaButton")}
            </ButtonLink>
            <Button variant="ghost" className="w-full" onClick={() => setReaderOpen(true)}>
              {t("readBook")}
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-ink-soft">{t("fromPrice")}</p>
        </section>
      </aside>

      {/* The reader lives ONLY in the fullscreen overlay */}
      {readerOpen ? (
        <Flipbook
          book={book}
          pages={pages}
          index={pageIndex}
          onIndexChange={setPageIndex}
          fullscreenOnly
          onClose={() => setReaderOpen(false)}
        />
      ) : null}
    </div>
  );
}
