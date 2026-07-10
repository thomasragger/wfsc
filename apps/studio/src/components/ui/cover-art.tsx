import type { CSSProperties, ReactNode } from "react";

import { ArtPlaceholder } from "@/components/decor";
import { ProgressiveImage } from "@/components/ui/progressive-image";

/**
 * WFSC design system — CoverArt.
 * THE way a book cover is presented (preview hero, sample hero, reader cover
 * page): square art in the polaroid frame, and — when the title isn't
 * lettered into the artwork — a designed typographic overlay in the book's
 * own display font: balanced lines, gentle scrim, warm shadow. Optional
 * bottom pill (e.g. "Flip through the book") for clickable heroes.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
export function CoverArt({
  src,
  alt = "",
  title,
  titleStyle,
  pill,
  onClick,
  priority = false,
}: {
  src: string | null;
  alt?: string;
  /** Overlaid when the artwork does NOT carry a lettered title. */
  title?: string | null;
  /** Font family/weight of the book's display face. */
  titleStyle?: CSSProperties;
  /** Bottom call-to-action pill (only sensible together with onClick). */
  pill?: string;
  onClick?: () => void;
  priority?: boolean;
}) {
  const frame: ReactNode = (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-lavender shadow-polaroid ring-8 ring-white">
      {src ? (
        <ProgressiveImage
          src={src}
          alt={alt}
          priority={priority}
          className="h-full w-full"
          imgClassName="h-full w-full object-cover"
        />
      ) : (
        <ArtPlaceholder />
      )}
      {title ? (
        <div className="absolute inset-x-0 top-0 flex justify-center bg-gradient-to-b from-ink/45 via-ink/15 to-transparent px-[7%] pb-[16%] pt-[6%]">
          <span
            className="text-balance text-center text-[clamp(1.3rem,3.4vw,2.2rem)] font-extrabold leading-tight text-white drop-shadow-[0_2px_10px_rgba(60,20,5,0.55)]"
            style={titleStyle}
          >
            {title}
          </span>
        </div>
      ) : null}
      {pill ? (
        <span className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-ink/50 to-transparent pb-5 pt-10">
          <span className="rounded-full bg-white px-5 py-2.5 font-display text-sm font-bold text-ink shadow-fuzzy transition-colors group-hover:bg-marigold">
            {pill}
          </span>
        </span>
      ) : null}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={pill ?? alt}
        className="group block w-full transition-transform hover:scale-[1.01]"
      >
        {frame}
      </button>
    );
  }
  return frame;
}
