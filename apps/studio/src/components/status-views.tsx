"use client";

import { useEffect, useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import { Doodle, Sparkle } from "@/components/decor";
import { Card, Polaroid } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookPayload } from "@/lib/book-payload";

type StatusT = ReturnType<typeof useTranslations>;

/** What the pipeline is doing right now, read from the polled payload. */
function deriveStage(book: BookPayload, t: StatusT): { key: string; label: string } {
  const drawing = book.people.find((p) => !p.characterSheetUrl);
  const storySpreads = book.spreads.filter((s) => s.kind === "story");
  const written = storySpreads.some((s) => (s.text ?? "").trim().length > 0);

  if (!written) {
    return { key: "writing", label: t("writing") };
  }
  if (drawing) {
    return { key: `drawing-${drawing.id}`, label: t("drawing", { name: drawing.name }) };
  }
  const total = storySpreads.length || Math.max(Math.ceil(book.pageCount / 2), 1);
  const painted = storySpreads.filter((s) => s.imageUrl !== null).length;
  if (painted < total) {
    return {
      key: `painting-${painted}`,
      label: t("painting", { current: Math.min(painted + 1, total), total }),
    };
  }
  return { key: "binding", label: t("finishing") };
}

/**
 * The living "magic is happening" screen for generating phases: staged
 * progress from the polled payload, character sheets flipping in as they
 * finish, the fuzzy mascot bouncing, and rotating warm micro-copy.
 */
export function MagicHappening({
  book,
  title,
  body,
}: {
  book: BookPayload;
  title: string;
  body: string;
}) {
  const t = useTranslations("statusViews");
  const microCopy = t.raw("microCopy") as string[];
  const stage = useMemo(() => deriveStage(book, t), [book, t]);

  // The real book coming to life: the pipeline persists the generated title
  // and every spread's text before any image, then fills spread images in one
  // by one — all of it lands here through the same 5s poll. Old books / edge
  // states without spreads simply render the plain progress screen.
  const writtenSpreads = book.spreads.filter(
    (s) => s.kind === "story" && (s.text ?? "").trim().length > 0,
  );

  // Rotate a warm line every few seconds.
  const [lineIndex, setLineIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLineIndex((i) => (i + 1) % microCopy.length), 4200);
    return () => clearInterval(id);
  }, [microCopy.length]);

  // Remember which sheets were present on mount so only NEW arrivals flip in.
  const [seenSheets, setSeenSheets] = useState<Set<string>>(
    () => new Set(book.people.filter((p) => p.characterSheetUrl).map((p) => p.id)),
  );
  const arrivalIds = book.people
    .filter((p) => p.characterSheetUrl && !seenSheets.has(p.id))
    .map((p) => p.id)
    .join(",");
  useEffect(() => {
    if (!arrivalIds) return;
    // Mark them seen after the flip-in has played.
    const ids = arrivalIds.split(",");
    const t = setTimeout(() => {
      setSeenSheets((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    }, 900);
    return () => clearTimeout(t);
  }, [arrivalIds]);

  return (
    <Card className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-5 overflow-hidden px-6 py-14 text-center sm:px-10">
      <Doodle src="cloud.png" size={44} className="animate-float absolute left-8 top-8 opacity-70" />
      <Doodle src="flower.png" size={26} className="animate-drift absolute right-10 top-10 [animation-delay:0.6s]" />
      <Doodle src="heart-small.png" size={22} className="animate-twinkle absolute bottom-8 left-10" />

      <div className="relative h-28 w-28">
        <Doodle
          src="/mascot/part3.png"
          size={112}
          className="animate-bounce-soft"
          alt={t("mascotAlt")}
        />
        <Sparkle className="absolute -left-3 top-1 animate-twinkle text-cobalt" size={20} />
        <Sparkle className="absolute -right-4 top-8 animate-twinkle text-coral [animation-delay:0.7s]" size={16} />
        <Sparkle className="absolute -bottom-2 left-6 animate-twinkle text-marigold [animation-delay:1.3s]" size={18} />
      </div>

      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
      <p className="max-w-md text-sm leading-relaxed text-ink-soft">{body}</p>

      {/* The generated title, revealed the moment the story lands. */}
      {book.title ? (
        <div key={book.title} className="animate-page-in">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink/40">
            {t("titleReveal")}
          </p>
          <p className="mt-1 font-display text-xl font-extrabold leading-snug text-ink">
            {book.title}
          </p>
        </div>
      ) : null}

      {/* Live stage from the polled payload */}
      <div className="flex flex-col items-center gap-2.5">
        <p
          key={stage.key}
          className="animate-page-in font-display text-base font-extrabold text-coral"
          aria-live="polite"
        >
          {stage.label}
        </p>
        <div className="h-2 w-56 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full w-full animate-shimmer bg-gradient-to-r from-marigold via-coral to-marigold" />
        </div>
        <p key={lineIndex} className="animate-page-in text-xs italic text-ink-soft">
          {microCopy[lineIndex]}
        </p>
      </div>

      {/* Character sheets appear as they finish */}
      {book.people.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-start justify-center gap-4">
          {book.people.map((person, i) => (
            <div
              key={person.id}
              className={
                person.characterSheetUrl && !seenSheets.has(person.id) ? "animate-flip-in" : ""
              }
            >
              <Polaroid
                tilt={i % 2 === 0 ? "-2deg" : "2deg"}
                className="w-28"
                media={
                  person.characterSheetUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.characterSheetUrl}
                      alt={t("characterAlt", { name: person.name })}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <Skeleton className="aspect-square w-full" rounded="rounded-none" />
                  )
                }
                caption={
                  person.characterSheetUrl
                    ? person.name
                    : t("drawingCaption", { name: person.name })
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* The story so far: real spread text readable while the art is still
          being painted (shimmer), each finished illustration fading in via
          the polled payload. */}
      {writtenSpreads.length > 0 ? (
        <div className="mt-2 w-full text-left">
          <p className="text-center text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink/40">
            {t("storySoFar")}
          </p>
          <div className="-mx-2 mt-3 flex snap-x gap-3 overflow-x-auto px-2 pb-2 [scrollbar-width:thin]">
            {writtenSpreads.map((spread) => (
              <figure
                key={spread.id}
                className="w-36 shrink-0 snap-start rounded-xl bg-white p-2 shadow-fuzzy ring-1 ring-ink/5"
              >
                {spread.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={spread.imageUrl}
                    alt=""
                    className="animate-page-in aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <Skeleton className="aspect-square w-full" rounded="rounded-lg" />
                )}
                <figcaption className="mt-1.5 line-clamp-3 px-0.5 text-[10px] leading-snug text-ink-soft">
                  {spread.text}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-2 max-w-sm text-xs leading-relaxed text-ink-soft">{t("emailNote")}</p>
    </Card>
  );
}

const TIMELINE_STEP_KEYS = ["approved", "sentToPrint", "shipped"] as const;

/** Celebratory timeline for approved / submitted_to_print / shipped. */
export function StatusTimeline({ book }: { book: BookPayload }) {
  const t = useTranslations("statusViews");
  const reached =
    book.status === "shipped" ? 3 : book.status === "submitted_to_print" ? 2 : 1;
  const subject = book.title ? `"${book.title}"` : t("timeline.yourStory");

  return (
    <Card className="relative mx-auto w-full max-w-2xl overflow-hidden px-8 py-12">
      <Sparkle className="absolute right-8 top-8 animate-twinkle text-marigold" size={22} />
      <Sparkle className="absolute bottom-10 left-8 animate-twinkle text-coral [animation-delay:0.9s]" size={16} />
      <div className="text-center">
        <p className="text-4xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
          {book.status === "shipped"
            ? t("timeline.shippedTitle")
            : book.status === "submitted_to_print"
              ? t("timeline.printingTitle")
              : t("timeline.approvedTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          {t("timeline.becomingReal", { subject })}
        </p>
      </div>

      <ol className="mt-10 flex flex-col gap-0">
        {TIMELINE_STEP_KEYS.map((stepKey, i) => {
          const done = i < reached;
          const isLast = i === TIMELINE_STEP_KEYS.length - 1;
          return (
            <li key={stepKey} className="relative flex gap-4 pb-8 last:pb-0">
              {!isLast ? (
                <span
                  className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 rounded ${
                    i < reached - 1 ? "bg-sage" : "bg-ink/10"
                  }`}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
                  done ? "bg-sage text-cream" : "bg-white text-ink-soft ring-2 ring-ink/10"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <div>
                <p className={`font-display font-bold ${done ? "text-ink" : "text-ink-soft"}`}>
                  {t(`timeline.${stepKey}.label`)}
                </p>
                <p className="text-sm text-ink-soft">{t(`timeline.${stepKey}.detail`)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
