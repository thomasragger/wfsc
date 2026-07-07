"use client";

import { FONT_PAIRINGS, fontStylesheetUrl } from "@wfsc/book-engine";

import { ArtPlaceholder, Sparkle } from "@/components/decor";
import type { BookPayload, SpreadPayload } from "@/lib/book-payload";

export type FlipPage =
  | { kind: "cover" }
  | { kind: "spread"; spread: SpreadPayload }
  | { kind: "locked"; morePages: number };

export function pageLabel(page: FlipPage): string {
  if (page.kind === "cover") return "Cover";
  if (page.kind === "locked") return "The rest of your book";
  if (page.spread.kind === "greeting") return "Dedication";
  return `Spread ${page.spread.position}`;
}

interface FlipbookProps {
  book: BookPayload;
  pages: FlipPage[];
  index: number;
  onIndexChange: (index: number) => void;
}

/**
 * Spread-by-spread pager. Pages are square (the printed book is 8.5×8.5 in),
 * so a spread renders as a 2:1 canvas with a soft center gutter.
 */
export function Flipbook({ book, pages, index, onIndexChange }: FlipbookProps) {
  const pairing = FONT_PAIRINGS[book.fontPairing];
  const displayFont = { fontFamily: `'${pairing.display.family}', sans-serif`, fontWeight: pairing.display.weight };
  const bodyFont = { fontFamily: `'${pairing.body.family}', sans-serif`, fontWeight: pairing.body.weight };
  const page = pages[Math.min(index, pages.length - 1)];
  if (!page) return null;

  return (
    <div
      className="flex flex-col items-center gap-4"
      tabIndex={0}
      role="group"
      aria-label="Book preview"
      aria-roledescription="flipbook"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
        if (e.key === "ArrowRight" && index < pages.length - 1) onIndexChange(index + 1);
      }}
    >
      {/* React hoists this to <head>; loads the pairing's Google fonts. */}
      <link rel="stylesheet" href={fontStylesheetUrl(pairing)} />

      <div className="relative w-full max-w-3xl">
        {page.kind === "cover" ? (
          <div className="mx-auto w-full max-w-sm">
            <div className="relative aspect-square overflow-hidden rounded-lg shadow-polaroid ring-8 ring-white">
              {book.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.coverImageUrl} alt="Book cover" className="h-full w-full object-cover" />
              ) : (
                <ArtPlaceholder label="Cover illustration on its way" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/60 to-transparent px-6 pb-6 pt-14 text-center">
                <p className="text-2xl leading-snug text-cream drop-shadow" style={displayFont}>
                  {book.title ?? "Your storybook"}
                </p>
              </div>
            </div>
          </div>
        ) : page.kind === "locked" ? (
          <div className="relative aspect-2/1 overflow-hidden rounded-lg shadow-polaroid ring-8 ring-white">
            <div className="absolute inset-0 grid grid-cols-2">
              <div className="bg-gradient-to-br from-lavender to-cream blur-[2px]" />
              <div className="bg-gradient-to-bl from-peach to-cream blur-[2px]" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/40 px-6 text-center backdrop-blur-[3px]">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-marigold text-xl shadow-fuzzy" aria-hidden="true">
                🔒
              </span>
              <p className="font-display text-lg font-bold text-ink">
                {page.morePages} more pages are waiting for you
              </p>
              <p className="max-w-sm text-sm text-ink-soft">
                The full story gets illustrated as soon as you order your book.
              </p>
            </div>
          </div>
        ) : (
          <SpreadCanvas spread={page.spread} bodyFont={bodyFont} />
        )}

        {/* Page turn buttons */}
        <button
          type="button"
          aria-label="Previous page"
          disabled={index === 0}
          onClick={() => onIndexChange(index - 1)}
          className="absolute -left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white font-display text-lg text-ink shadow-fuzzy transition hover:bg-marigold disabled:opacity-30 sm:-left-5"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={index === pages.length - 1}
          onClick={() => onIndexChange(index + 1)}
          className="absolute -right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white font-display text-lg text-ink shadow-fuzzy transition hover:bg-marigold disabled:opacity-30 sm:-right-5"
        >
          ›
        </button>
      </div>

      {/* Dot nav */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold text-ink-soft">{pageLabel(page)}</p>
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Pages">
          {pages.map((p, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={pageLabel(p)}
              onClick={() => onIndexChange(i)}
              className={`h-2.5 rounded-full transition-all ${
                i === index ? "w-6 bg-coral" : "w-2.5 bg-ink/15 hover:bg-ink/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SpreadCanvas({
  spread,
  bodyFont,
}: {
  spread: SpreadPayload;
  bodyFont: React.CSSProperties;
}) {
  const text = spread.text?.trim() ?? "";

  const textBlock = (
    <div
      className="flex h-full w-full items-center justify-center bg-cream p-[7%] text-center"
      style={bodyFont}
    >
      <p className="whitespace-pre-line text-[clamp(0.8rem,2.2vw,1.15rem)] leading-relaxed text-ink">
        {text || "…"}
      </p>
    </div>
  );

  const imageBlock = (label?: string) =>
    spread.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={spread.imageUrl} alt="" className="h-full w-full object-cover" />
    ) : (
      <ArtPlaceholder label={label ?? "Illustration on its way"} />
    );

  return (
    <div className="relative aspect-2/1 overflow-hidden rounded-lg shadow-polaroid ring-8 ring-white">
      {spread.kind === "greeting" ? (
        <div
          className="flex h-full w-full items-center justify-center bg-cream p-[8%] text-center"
          style={bodyFont}
        >
          <div>
            <Sparkle className="mx-auto mb-3 text-marigold" size={18} />
            <p className="whitespace-pre-line text-[clamp(0.85rem,2.4vw,1.25rem)] italic leading-relaxed text-ink">
              {text || "Your dedication will live here."}
            </p>
          </div>
        </div>
      ) : spread.layout === "full-bleed-overlay" ? (
        <>
          <div className="absolute inset-0">{imageBlock()}</div>
          {text ? (
            <div className="absolute inset-x-[10%] bottom-[8%] rounded-2xl bg-cream/85 px-6 py-4 text-center backdrop-blur-sm" style={bodyFont}>
              <p className="whitespace-pre-line text-[clamp(0.8rem,2vw,1.05rem)] leading-relaxed text-ink">
                {text}
              </p>
            </div>
          ) : null}
        </>
      ) : spread.layout === "text-bottom" ? (
        <div className="flex h-full flex-col">
          <div className="h-2/3 w-full overflow-hidden">{imageBlock()}</div>
          <div className="flex h-1/3 items-center justify-center bg-cream px-[8%] text-center" style={bodyFont}>
            <p className="whitespace-pre-line text-[clamp(0.75rem,1.9vw,1rem)] leading-relaxed text-ink">
              {text || "…"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid h-full grid-cols-2">
          {spread.layout === "text-left" ? (
            <>
              {textBlock}
              <div className="overflow-hidden">{imageBlock()}</div>
            </>
          ) : (
            <>
              <div className="overflow-hidden">{imageBlock()}</div>
              {textBlock}
            </>
          )}
        </div>
      )}

      {/* Center gutter */}
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-ink/15 to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
