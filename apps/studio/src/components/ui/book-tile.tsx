import Link from "next/link";

import { ArtPlaceholder } from "@/components/decor";
import { ProgressiveImage } from "@/components/ui/progressive-image";

/**
 * WFSC design system — BookTile / BookTileVisual.
 * How a BOOK is shown everywhere one appears: the hero's floating riders,
 * the flip-through marquee, the samples gallery, "start from a story"
 * template cards. Deliberately NOT the category treatment — a book is a
 * real photographed (or illustrated-cover) object, shown whole in a clean
 * rounded frame, not cropped into a blob mask. Caption sits below the
 * image, never overlaid, so a book's own cover art (which often already
 * carries its illustrated title) stays fully visible.
 *
 * The image carries NO baked shadow — the frame is flat and clean. Where a
 * book should read as a physical object floating in space (hero, marquee),
 * the caller passes a shadow via `className`; interactive cards get their
 * lift shadow from the wrapping .tile-lift instead.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export const BOOK_TILE_SIZES = {
  sm: "w-40 sm:w-48",
  md: "w-52 sm:w-60",
  lg: "w-56 sm:w-64",
} as const;

export type BookTileSize = keyof typeof BOOK_TILE_SIZES;

export function BookTileVisual({
  image,
  hoverImage = null,
  alt = "",
  priority = false,
  aspectClassName = "aspect-[4/5]",
  className = "",
}: {
  image: string | null;
  /** Cross-faded in on hover of an ancestor `.group` (e.g. the flat preview at
   *  rest, the photographed 3D mockup on hover). Ignored if absent. */
  hoverImage?: string | null;
  alt?: string;
  priority?: boolean;
  /** Override the frame's aspect ratio (default 4:5). */
  aspectClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative ${aspectClassName} w-full overflow-hidden rounded-2xl bg-cream ${className}`.trim()}
    >
      {image ? (
        <ProgressiveImage
          src={image}
          alt={alt}
          priority={priority}
          className={`h-full w-full transition-opacity duration-300 ${hoverImage ? "group-hover:opacity-0" : ""}`}
          imgClassName="h-full w-full object-cover"
        />
      ) : (
        <ArtPlaceholder />
      )}
      {hoverImage ? (
        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <ProgressiveImage src={hoverImage} alt="" className="h-full w-full" imgClassName="h-full w-full object-cover" />
        </div>
      ) : null}
    </div>
  );
}

export function BookTile({
  href,
  image,
  hoverImage = null,
  title,
  category,
  tagline,
  size = "md",
  aspectClassName,
  priority = false,
  className = "",
}: {
  href: string;
  image: string | null;
  /** Cross-faded in on hover (e.g. the 3D mockup over the flat preview). */
  hoverImage?: string | null;
  title: string;
  /** Small-caps byline (e.g. the category). Ignored when `tagline` is set. */
  category?: string | null;
  /** A soft one-liner under the title (e.g. a template's pitch). */
  tagline?: string | null;
  size?: BookTileSize;
  aspectClassName?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      draggable={false}
      className={`tile-lift group flex ${BOOK_TILE_SIZES[size]} shrink-0 flex-col rounded-2xl ${className}`.trim()}
    >
      <BookTileVisual image={image} hoverImage={hoverImage} alt={title} aspectClassName={aspectClassName} priority={priority} />
      {/* Generous breathing room around the caption — a book jacket, not a
          cramped thumbnail label. */}
      <div className="px-3 pb-2 pt-5 text-center">
        <p className="font-display text-[0.95rem] font-extrabold leading-snug text-ink transition-colors group-hover:text-coral">
          {title}
        </p>
        {tagline ? (
          <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">{tagline}</p>
        ) : category ? (
          <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-coral/75">
            {category}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
