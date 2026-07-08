"use client";

import { useEffect, useMemo, useState } from "react";

import { Doodle, Sparkle } from "@/components/decor";
import { Card, Polaroid } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookPayload } from "@/lib/book-payload";

const MICRO_COPY = [
  "Mixing just the right shade of bedtime blue…",
  "Teaching the illustrations to hold still…",
  "Sneaking an extra warm fuzzy onto every page…",
  "Double-checking that everyone's smile is right…",
  "Whispering your story to the paintbrushes…",
  "Adding one more twinkle, because why not…",
];

/** What the pipeline is doing right now, read from the polled payload. */
function deriveStage(book: BookPayload): { key: string; label: string } {
  const drawing = book.people.find((p) => !p.characterSheetUrl);
  const storySpreads = book.spreads.filter((s) => s.kind === "story");
  const written = storySpreads.some((s) => (s.text ?? "").trim().length > 0);

  if (!written) {
    return { key: "writing", label: "Writing your story…" };
  }
  if (drawing) {
    return { key: `drawing-${drawing.id}`, label: `Drawing ${drawing.name}…` };
  }
  const total = storySpreads.length || Math.max(Math.ceil(book.pageCount / 2), 1);
  const painted = storySpreads.filter((s) => s.imageUrl !== null).length;
  if (painted < total) {
    return {
      key: `painting-${painted}`,
      label: `Painting page ${Math.min(painted + 1, total)} of ${total}…`,
    };
  }
  return { key: "binding", label: "Putting the finishing touches on…" };
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
  const stage = useMemo(() => deriveStage(book), [book]);

  // Rotate a warm line every few seconds.
  const [lineIndex, setLineIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLineIndex((i) => (i + 1) % MICRO_COPY.length), 4200);
    return () => clearInterval(id);
  }, []);

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
          alt="Warm Fuzzy mascot conjuring your book"
        />
        <Sparkle className="absolute -left-3 top-1 animate-twinkle text-cobalt" size={20} />
        <Sparkle className="absolute -right-4 top-8 animate-twinkle text-coral [animation-delay:0.7s]" size={16} />
        <Sparkle className="absolute -bottom-2 left-6 animate-twinkle text-marigold [animation-delay:1.3s]" size={18} />
      </div>

      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
      <p className="max-w-md text-sm leading-relaxed text-ink-soft">{body}</p>

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
          {MICRO_COPY[lineIndex]}
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
                      alt={`${person.name} as a storybook character`}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <Skeleton className="aspect-square w-full" rounded="rounded-none" />
                  )
                }
                caption={person.characterSheetUrl ? person.name : `Drawing ${person.name}…`}
              />
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-2 max-w-sm text-xs leading-relaxed text-ink-soft">
        We&rsquo;ll email you a link — you can safely close this page. It also updates by
        itself, no need to refresh.
      </p>
    </Card>
  );
}

const TIMELINE_STEPS = [
  { key: "approved", label: "Approved", detail: "You signed off on every page." },
  { key: "submitted_to_print", label: "Sent to print", detail: "Your book is on the press." },
  { key: "shipped", label: "Shipped", detail: "On its way to your doorstep." },
] as const;

/** Celebratory timeline for approved / submitted_to_print / shipped. */
export function StatusTimeline({ book }: { book: BookPayload }) {
  const reached =
    book.status === "shipped" ? 3 : book.status === "submitted_to_print" ? 2 : 1;

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
            ? "Your book is on its way!"
            : book.status === "submitted_to_print"
              ? "Your book is being printed!"
              : "Your book is approved!"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          {book.title ? `"${book.title}"` : "Your story"} is becoming a real, printed book.
          We&rsquo;ll email you at every step.
        </p>
      </div>

      <ol className="mt-10 flex flex-col gap-0">
        {TIMELINE_STEPS.map((step, i) => {
          const done = i < reached;
          const isLast = i === TIMELINE_STEPS.length - 1;
          return (
            <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
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
                  {step.label}
                </p>
                <p className="text-sm text-ink-soft">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
