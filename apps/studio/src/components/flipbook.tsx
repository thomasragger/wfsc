"use client";

import { useEffect, useRef, useState } from "react";

import { createTranslator, useTranslations } from "next-intl";

import { FONT_PAIRINGS, SCRIPT_FONT, fontStylesheetUrl } from "@wfsc/book-engine";

import { Sparkle } from "@/components/decor";
import { ButtonLink } from "@/components/ui/button";
import { CoverImage } from "@/components/ui/cover-image";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { Skeleton } from "@/components/ui/skeleton";
import deMessages from "../../messages/de.json";
import enMessages from "../../messages/en.json";
import type { BookPayload, SpreadPayload } from "@/lib/book-payload";

type FlipT = ReturnType<typeof useTranslations>;

// The dedication signature ("Love, {name}" / "Alles Liebe, {name}") is printed
// content, so it follows the BOOK's own locale — passed via the payload — not
// the viewer's UI locale. We resolve it against the matching message catalog.
const BOOK_MESSAGES: Record<string, typeof enMessages> = {
  en: enMessages,
  // de.json is a partial override (missing keys fall back to en per-key), but
  // it does carry every `flipbook` key we read here.
  de: deMessages as unknown as typeof enMessages,
};

export type FlipPage =
  | { kind: "cover" }
  | { kind: "title"; title: string; styleName?: string | null }
  | { kind: "dedication"; text: string; from?: string | null }
  | { kind: "spread"; spread: SpreadPayload }
  | { kind: "locked"; morePages: number; variant: number };

export function pageLabel(page: FlipPage, t: FlipT): string {
  if (page.kind === "cover") return t("cover");
  if (page.kind === "title") return t("titlePage");
  if (page.kind === "dedication") return t("dedication");
  if (page.kind === "locked") return t("lockedLabel");
  if (page.spread.kind === "greeting") return t("dedication");
  return t("spread", { position: page.spread.position });
}

interface FlipbookProps {
  book: BookPayload;
  pages: FlipPage[];
  index: number;
  onIndexChange: (index: number) => void;
}

/**
 * Premium spread viewer: left text page + right illustration page (both
 * square, like the printed 8.5×8.5 in book), with a simple crossfade/slide
 * between spreads. 'text-right' renders mirrored; legacy layouts fall back
 * to text-left. Illustrations are contain-fit on cream — a face is never
 * cropped. Keyboard arrows, swipe, and the dot rail all navigate.
 */
export function Flipbook({ book, pages, index, onIndexChange }: FlipbookProps) {
  const t = useTranslations("flipbook");
  // Book-locale translator for printed-page copy (see BOOK_MESSAGES above).
  const bookLocale = book.locale === "de" ? "de" : "en";
  const tBook = createTranslator({
    locale: bookLocale,
    messages: BOOK_MESSAGES[bookLocale],
    namespace: "flipbook",
  });
  const pairing = FONT_PAIRINGS[book.fontPairing];
  const displayFont = {
    fontFamily: `'${pairing.display.family}', sans-serif`,
    fontWeight: pairing.display.weight,
  };
  const bodyFont = {
    fontFamily: `'${pairing.body.family}', sans-serif`,
    fontWeight: pairing.body.weight,
  };
  // The personalized dedication (Widmung) is always set in the handwritten
  // script face, like a note penned inside a gift.
  const scriptFont = {
    fontFamily: `'${SCRIPT_FONT.family}', cursive`,
    fontWeight: SCRIPT_FONT.weight,
  };

  const clamped = Math.min(index, pages.length - 1);

  // Crossfade/slide: keep the outgoing spread mounted briefly while the
  // incoming one slides in.
  const [displayed, setDisplayed] = useState(clamped);
  const [leaving, setLeaving] = useState<{ pageIndex: number; forward: boolean } | null>(null);
  // Adjust-state-during-render (the React-sanctioned derived-state pattern):
  // when the requested index changes, remember the outgoing spread.
  if (clamped !== displayed) {
    setLeaving({ pageIndex: displayed, forward: clamped > displayed });
    setDisplayed(clamped);
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), 400);
    return () => clearTimeout(t);
  }, [leaving]);

  // Fullscreen overlay reading mode: same viewer, near-viewport size.
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // Swipe navigation (pointer-based, works for touch and mouse).
  const swipe = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    swipe.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!swipe.current) return;
    const dx = e.clientX - swipe.current.x;
    const dy = e.clientY - swipe.current.y;
    swipe.current = null;
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0 && clamped < pages.length - 1) onIndexChange(clamped + 1);
    if (dx > 0 && clamped > 0) onIndexChange(clamped - 1);
  }

  const page = pages[displayed];
  if (!page) return null;
  const leavingPage = leaving ? pages[leaving.pageIndex] : null;

  function renderPage(p: FlipPage) {
    if (p.kind === "cover") {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
          <CoverImage src={book.coverImageUrl} alt={t("bookCoverAlt")} size="lg" priority />
          {/* When the title is illustrated onto the cover, don't repeat it. */}
          {book.coverHasTitle ? null : (
            <h2 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              {book.title ?? t("defaultTitle")}
            </h2>
          )}
        </div>
      );
    }
    if (p.kind === "title") {
      return (
        <PageFrame>
          <div className="grid h-full grid-cols-2">
            {/* verso: publisher imprint */}
            <div className="flex flex-col items-center justify-between bg-cream px-[12%] py-[14%] text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Warm Fuzzy Story Club" className="h-9 w-auto opacity-90 sm:h-11" />
              <span className="font-display text-lg text-marigold" aria-hidden="true">❦</span>
              <p className="text-[clamp(0.5rem,1.2vw,0.68rem)] font-semibold uppercase tracking-[0.18em] text-ink/40">
                {t("imprint")}
              </p>
            </div>
            {/* recto: title */}
            <div className="flex flex-col items-center justify-center gap-3 bg-cream px-[10%] text-center">
              <h2 className="font-display text-[clamp(1.3rem,3.4vw,2.4rem)] font-extrabold leading-tight text-ink" style={displayFont}>
                {p.title}
              </h2>
              {p.styleName ? (
                <p className="text-[clamp(0.62rem,1.5vw,0.85rem)] italic text-ink-soft" style={bodyFont}>
                  {t("styleLine", { style: p.styleName })}
                </p>
              ) : null}
              <Sparkle className="mt-1 text-marigold" size={18} />
            </div>
          </div>
        </PageFrame>
      );
    }
    if (p.kind === "dedication") {
      return (
        <PageFrame>
          <div className="grid h-full grid-cols-2">
            {/* verso: quiet decorative page */}
            <div className="flex items-center justify-center bg-cream">
              <div className="flex flex-col items-center gap-2 text-marigold/70" aria-hidden="true">
                <Sparkle size={16} />
                <span className="font-display text-2xl">❦</span>
                <Sparkle size={12} />
              </div>
            </div>
            {/* recto: dedication + who it's from */}
            <div className="flex flex-col items-center justify-center bg-cream px-[11%] text-center" style={bodyFont}>
              <p className="text-[clamp(0.55rem,1.3vw,0.72rem)] font-semibold uppercase tracking-[0.2em] text-ink/35">
                {t("dedication")}
              </p>
              <p
                className="mt-4 whitespace-pre-line text-[clamp(1.15rem,3.2vw,1.8rem)] leading-snug text-ink"
                style={scriptFont}
              >
                {p.text}
              </p>
              {p.from ? (
                <p
                  className="mt-4 text-[clamp(1.05rem,2.8vw,1.5rem)] text-ink-soft"
                  style={scriptFont}
                >
                  {tBook("dedicationFrom", { name: p.from })}
                </p>
              ) : null}
            </div>
          </div>
        </PageFrame>
      );
    }
    if (p.kind === "locked") {
      return <LockedSpread morePages={p.morePages} variant={p.variant} t={t} />;
    }
    return <SpreadCanvas spread={p.spread} bodyFont={bodyFont} displayFont={displayFont} t={t} />;
  }

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/90 p-4 backdrop-blur-sm sm:p-8"
          : "flex flex-col items-center gap-4"
      }
      tabIndex={0}
      role="group"
      aria-label={t("bookPreview")}
      aria-roledescription={t("bookViewer")}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" && clamped > 0) onIndexChange(clamped - 1);
        if (e.key === "ArrowRight" && clamped < pages.length - 1) onIndexChange(clamped + 1);
        if (e.key === "Escape") setFullscreen(false);
      }}
      onClick={(e) => {
        // Backdrop click closes the overlay (clicks on the book don't bubble here
        // with a matching target).
        if (fullscreen && e.target === e.currentTarget) setFullscreen(false);
      }}
    >
      {/* React hoists this to <head>; loads the pairing's Google fonts. */}
      <link rel="stylesheet" href={fontStylesheetUrl(pairing)} />

      {/* Width is viewport-height-aware: a 2:1 spread at min(78rem, 150vh)
          never exceeds ~75vh tall, so wide screens get a genuinely big book
          without pushing the pager off-screen. */}
      <div
        className={`relative w-full ${
          fullscreen ? "max-w-[min(96vw,170vh)]" : "max-w-[min(78rem,150vh)]"
        }`}
      >
        <button
          type="button"
          aria-label={fullscreen ? t("closeFullscreen") : t("viewLarger")}
          onClick={() => setFullscreen((f) => !f)}
          className="absolute -top-4 right-0 z-20 flex h-9 w-9 -translate-y-full items-center justify-center rounded-full bg-white text-ink shadow-fuzzy transition hover:bg-marigold"
        >
          {fullscreen ? (
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" />
            </svg>
          )}
        </button>
        <div
          className="relative aspect-2/1 touch-pan-y select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {leavingPage ? (
            <div className="animate-fade-out pointer-events-none absolute inset-0" aria-hidden="true">
              {renderPage(leavingPage)}
            </div>
          ) : null}
          <div
            key={displayed}
            className={`absolute inset-0 ${
              leaving
                ? leaving.forward
                  ? "animate-slide-in-right"
                  : "animate-slide-in-left"
                : ""
            }`}
          >
            {renderPage(page)}
          </div>
        </div>

        {/* Page turn buttons */}
        <button
          type="button"
          aria-label={t("previousPage")}
          disabled={clamped === 0}
          onClick={() => onIndexChange(clamped - 1)}
          className="absolute -left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-fuzzy transition hover:bg-marigold disabled:opacity-30 sm:-left-5"
        >
          <IconChevronLeft />
        </button>
        <button
          type="button"
          aria-label={t("nextPage")}
          disabled={clamped === pages.length - 1}
          onClick={() => onIndexChange(clamped + 1)}
          className="absolute -right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-fuzzy transition hover:bg-marigold disabled:opacity-30 sm:-right-5"
        >
          <IconChevronRight />
        </button>
      </div>

      {/* Dot nav */}
      <div className="flex items-center gap-3">
        <p className={`text-xs font-semibold ${fullscreen ? "text-cream/80" : "text-ink-soft"}`}>
          {pageLabel(pages[clamped], t)}
        </p>
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t("pages")}>
          {pages.map((p, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === clamped}
              aria-label={pageLabel(p, t)}
              onClick={() => onIndexChange(i)}
              className={`h-2.5 rounded-full transition-all ${
                i === clamped
                  ? "w-6 bg-coral"
                  : fullscreen
                    ? "w-2.5 bg-white/30 hover:bg-white/50"
                    : "w-2.5 bg-ink/15 hover:bg-ink/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One spread = two square pages. The illustration page letterboxes its art
 * (object-contain on cream) so nothing — especially a face — is ever cropped.
 */
function SpreadCanvas({
  spread,
  bodyFont,
  displayFont,
  t,
}: {
  spread: SpreadPayload;
  bodyFont: React.CSSProperties;
  displayFont: React.CSSProperties;
  t: FlipT;
}) {
  const text = spread.text?.trim() ?? "";
  const mirrored = spread.layout === "text-right"; // every other layout reads text-left

  if (spread.kind === "greeting") {
    return (
      <PageFrame>
        <div
          className="flex h-full w-full items-center justify-center bg-cream p-[8%] text-center"
          style={bodyFont}
        >
          <div>
            <Sparkle className="mx-auto mb-3 text-marigold" size={18} />
            <p className="whitespace-pre-line text-[clamp(0.85rem,2.4vw,1.25rem)] italic leading-relaxed text-ink">
              {text || t("dedicationPlaceholder")}
            </p>
            <p className="mt-4 font-display text-sm text-ink-soft" style={displayFont} aria-hidden="true">
              ❦
            </p>
          </div>
        </div>
      </PageFrame>
    );
  }

  const textPage = (
    <div
      className="flex aspect-square h-full items-center justify-center bg-cream p-[7%] text-center"
      style={bodyFont}
    >
      <p className="whitespace-pre-line text-[clamp(0.8rem,2.2vw,1.15rem)] leading-relaxed text-ink">
        {text || "…"}
      </p>
    </div>
  );

  // Full-bleed: the illustration fills the whole page edge-to-edge (square
  // art in a square page → object-cover crops nothing), matching the printed
  // book's full-page illustrations.
  const imagePage = (
    <div className="aspect-square h-full bg-cream">
      {spread.imageUrl ? (
        <ProgressiveImage
          src={spread.imageUrl}
          alt=""
          className="h-full w-full"
          imgClassName="h-full w-full object-cover"
        />
      ) : (
        <Skeleton className="h-full w-full" rounded="rounded-none" />
      )}
    </div>
  );

  return (
    <PageFrame>
      <div className="grid h-full grid-cols-2">
        {mirrored ? (
          <>
            {imagePage}
            {textPage}
          </>
        ) : (
          <>
            {textPage}
            {imagePage}
          </>
        )}
      </div>
    </PageFrame>
  );
}

/** Shared spread chrome: white book edge, soft shadow, center gutter. */
function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg shadow-polaroid ring-8 ring-white">
      {children}
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-ink/15 to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}

/* ---------------------------------------------------------------- locked */

const LOCKED_PALETTES: [string, string, string][] = [
  ["#f6b73c", "#e8622c", "#fbe3cb"],
  ["#f9c5d1", "#e8622c", "#ece5f8"],
  ["#9db8f0", "#2e5fd7", "#ece5f8"],
];

/**
 * A locked teaser spread shown before purchase: a believable page layout
 * (soft out-of-focus art + squiggle "text" lines — never the real copy)
 * under a warm blur, with a lock badge and an unlock CTA.
 */
function LockedSpread({
  morePages,
  variant,
  t,
}: {
  morePages: number;
  variant: number;
  t: FlipT;
}) {
  const [from, to, wash] = LOCKED_PALETTES[variant % LOCKED_PALETTES.length];
  const imageLeft = variant % 2 === 1;

  const art = (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: `linear-gradient(140deg, ${wash}, #fffaf7)` }}
    >
      <div
        className="absolute -left-[8%] top-[10%] h-[58%] w-[46%] rounded-full opacity-70 blur-2xl"
        style={{ background: from }}
      />
      <div
        className="absolute bottom-[6%] right-[4%] h-[52%] w-[52%] rounded-full opacity-60 blur-2xl"
        style={{ background: to }}
      />
      <div className="absolute left-[32%] top-[44%] h-[36%] w-[30%] rounded-full bg-white opacity-50 blur-xl" />
    </div>
  );

  const textPage = (
    <div className="flex h-full w-full items-center justify-center bg-cream p-[9%]">
      <SquiggleLines />
    </div>
  );

  return (
    <PageFrame>
      {/* Fake layout, blurred so nothing reads as content */}
      <div className="absolute inset-0 grid grid-cols-2 blur-[5px]" aria-hidden="true">
        {imageLeft ? (
          <>
            {art}
            {textPage}
          </>
        ) : (
          <>
            {textPage}
            {art}
          </>
        )}
      </div>

      {/* Warm veil + message */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/35 px-6 text-center backdrop-blur-[2px]">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full bg-marigold text-ink shadow-fuzzy"
          aria-hidden="true"
        >
          <LockIcon />
        </span>
        <p className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {t("morePagesWaiting", { count: morePages })}
        </p>
        <p className="max-w-sm text-sm font-medium text-ink-soft">{t("unlockBody")}</p>
        <ButtonLink href="#unlock" size="sm" className="mt-1">
          {t("unlockCta")}
        </ButtonLink>
      </div>
    </PageFrame>
  );
}

/** Placeholder "text" for locked pages — friendly squiggles, no real words. */
function SquiggleLines() {
  const lines = [
    { width: 92, y: 6 },
    { width: 84, y: 15 },
    { width: 96, y: 24 },
    { width: 72, y: 33 },
    { width: 88, y: 42 },
    { width: 46, y: 51 },
  ];
  return (
    <svg viewBox="0 0 100 58" className="h-auto w-full max-w-[15rem] opacity-40" aria-hidden="true">
      {lines.map((line, i) => {
        const segments = Math.max(Math.floor((line.width - 4) / 8), 1);
        const d = `M4 ${line.y} q 4 -2.4 8 0 ${"t 8 0 ".repeat(segments - 1)}`;
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#761e0b"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" fill="#761e0b" />
      <path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        stroke="#761e0b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15" r="1.6" fill="#f6b73c" />
    </svg>
  );
}
