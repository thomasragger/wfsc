import Link from "next/link";

import { ArtPlaceholder } from "@/components/decor";

/**
 * WFSC design system — BookTile / BookTileVisual.
 * How a BOOK is shown everywhere one appears: the hero's floating riders,
 * the sample-book teaser, the samples gallery, "start from a story"
 * template cards. Deliberately NOT the category treatment — a book is a
 * real photographed (or illustrated-cover) object, shown whole in a clean
 * rounded frame, not cropped into a blob mask. Caption sits below the
 * image, never overlaid, so a book's own cover art (which often already
 * carries its illustrated title) stays fully visible.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export const BOOK_TILE_SIZES = {
  sm: "w-40 sm:w-48",
  md: "w-52 sm:w-60",
} as const;

export type BookTileSize = keyof typeof BOOK_TILE_SIZES;

export function BookTileVisual({
  image,
  alt = "",
  priority = false,
  className = "",
}: {
  image: string | null;
  alt?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`aspect-[4/5] w-full overflow-hidden rounded-2xl bg-cream shadow-fuzzy ${className}`.trim()}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={alt}
          draggable={false}
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <ArtPlaceholder />
      )}
    </div>
  );
}

export function BookTile({
  href,
  image,
  title,
  category,
  size = "md",
  className = "",
}: {
  href: string;
  image: string | null;
  title: string;
  category?: string | null;
  size?: BookTileSize;
  className?: string;
}) {
  return (
    <Link
      href={href}
      draggable={false}
      className={`tile-lift group flex ${BOOK_TILE_SIZES[size]} shrink-0 flex-col rounded-2xl ${className}`.trim()}
    >
      <BookTileVisual image={image} alt={title} />
      <div className="pt-3 text-center">
        <p className="font-display text-sm font-extrabold leading-snug text-ink group-hover:text-coral">
          {title}
        </p>
        {/* Editorial byline, not a pill — like the small-caps line on a book jacket. */}
        {category ? (
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-coral/75">
            {category}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
