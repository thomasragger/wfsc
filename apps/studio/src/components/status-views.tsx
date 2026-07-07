"use client";

import { Sparkle } from "@/components/decor";
import type { BookPayload } from "@/lib/book-payload";

/** Animated "the magic is happening" state for generating phases. */
export function MagicHappening({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="card relative mx-auto flex w-full max-w-2xl flex-col items-center gap-5 overflow-hidden px-8 py-16 text-center">
      <div className="relative h-24 w-24">
        <span className="absolute inset-0 animate-float rounded-full bg-gradient-to-br from-marigold to-coral opacity-90" />
        <Sparkle className="absolute -left-3 top-1 animate-twinkle text-cobalt" size={20} />
        <Sparkle className="absolute -right-4 top-8 animate-twinkle text-coral [animation-delay:0.7s]" size={16} />
        <Sparkle className="absolute -bottom-2 left-6 animate-twinkle text-sage [animation-delay:1.3s]" size={18} />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
      <p className="max-w-md text-sm leading-relaxed text-ink-soft">{body}</p>
      <div className="h-2 w-56 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full w-full animate-shimmer bg-gradient-to-r from-marigold via-coral to-marigold" />
      </div>
      <p className="text-xs text-ink-soft">
        This page updates by itself — no need to refresh.
      </p>
    </div>
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
    <div className="card relative mx-auto w-full max-w-2xl overflow-hidden px-8 py-12">
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
    </div>
  );
}
