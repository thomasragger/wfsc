import Link from "next/link";

import { maskClipId, pickBookMask, pickCategoryMask } from "@/components/decor";
import { PillLabel } from "@/components/ui/chip";

/**
 * WFSC design system — PhotoTile.
 * The book/category card used throughout the app: a gradient card with a
 * masked photo inset and a pill label — the SAME size and layout wherever a
 * book or a category needs to be browsed (the hero's category row, the
 * sample-book teaser, the samples gallery). One component so these can
 * never drift apart in size or layout again.
 *
 * `variant` picks the mask *family* (categories: ovals & bubbles; books:
 * the original scallop/shell/coil) so the two content types read as
 * distinct at a glance; the exact shape within that family is picked
 * deterministically per tile (via `href`) for organic variety without
 * client/server render mismatches.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export const PHOTO_TILE_SIZES = {
  sm: "w-44 sm:w-52",
  md: "w-52 sm:w-60",
} as const;

export type PhotoTileSize = keyof typeof PHOTO_TILE_SIZES;
export type PhotoTileVariant = "category" | "book";

export function PhotoTile({
  href,
  image,
  label,
  gradientFrom,
  gradientTo,
  size = "md",
  variant = "book",
  className = "",
}: {
  href: string;
  image: string | null;
  label: string;
  gradientFrom: string;
  gradientTo: string;
  size?: PhotoTileSize;
  variant?: PhotoTileVariant;
  className?: string;
}) {
  const mask = variant === "category" ? pickCategoryMask(href) : pickBookMask(href);

  return (
    <Link
      href={href}
      draggable={false}
      className={`tile-lift group relative aspect-[4/5] ${PHOTO_TILE_SIZES[size]} shrink-0 rounded-3xl ${className}`.trim()}
      style={{ background: `linear-gradient(160deg, ${gradientFrom}, ${gradientTo})` }}
    >
      {/* Clipping lives on an inner layer so the tile's own lift-shadow is never cut off. */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl">
        <div
          /* More room at the bottom than the other edges — the pill label
             sits there and must never touch the masked photo. */
          className="absolute inset-x-[10%] top-[9%] bottom-[24%] overflow-hidden bg-white/40"
          style={{ clipPath: `url(#${maskClipId(mask)})` }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={label}
              draggable={false}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
        </div>
      </div>
      <PillLabel className="absolute bottom-4 left-4">{label}</PillLabel>
    </Link>
  );
}
