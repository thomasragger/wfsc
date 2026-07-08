import Link from "next/link";

import { maskClipId, pickCategoryMask } from "@/components/decor";
import { PillLabel } from "@/components/ui/chip";

/**
 * WFSC design system — PhotoTile / PhotoTileVisual.
 * The category browsing card: a gradient card with an organic masked photo
 * inset and a pill label. Used for the "gifts for all your favorite people"
 * category row. Books use the separate, unmasked BookTile instead — see
 * src/components/ui/book-tile.tsx for why those two visual languages differ.
 *
 * The exact mask shape within the category family is picked deterministically
 * per tile (via `seed`) for organic variety without client/server render
 * mismatches.
 *
 * PhotoTileVisual is the presentational half (no link) — use it for
 * decorative/non-interactive placements. PhotoTile wraps it in a Link + the
 * shared tile-lift hover for anywhere it's clickable.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export const PHOTO_TILE_SIZES = {
  sm: "w-44 sm:w-52",
  md: "w-52 sm:w-60",
} as const;

export type PhotoTileSize = keyof typeof PHOTO_TILE_SIZES;

export function PhotoTileVisual({
  seed,
  image,
  label,
  gradientFrom,
  gradientTo,
  aspectClassName = "aspect-[4/5]",
  className = "",
}: {
  seed: string;
  image: string | null;
  label?: string;
  gradientFrom: string;
  gradientTo: string;
  /** Override the card's aspect ratio (default 4:5, matching PhotoTile). */
  aspectClassName?: string;
  className?: string;
}) {
  const mask = pickCategoryMask(seed);

  return (
    <div
      className={`relative ${aspectClassName} rounded-3xl ${className}`.trim()}
      style={{ background: `linear-gradient(160deg, ${gradientFrom}, ${gradientTo})` }}
    >
      {/* Clipping lives on an inner layer so the tile's own lift-shadow (from
          the caller's .tile-lift, if any) is never cut off. */}
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
              alt={label ?? ""}
              draggable={false}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
        </div>
      </div>
      {label ? <PillLabel className="absolute bottom-4 left-4">{label}</PillLabel> : null}
    </div>
  );
}

export function PhotoTile({
  href,
  image,
  label,
  gradientFrom,
  gradientTo,
  size = "md",
  className = "",
}: {
  href: string;
  image: string | null;
  label: string;
  gradientFrom: string;
  gradientTo: string;
  size?: PhotoTileSize;
  className?: string;
}) {
  return (
    <Link
      href={href}
      draggable={false}
      className={`tile-lift group ${PHOTO_TILE_SIZES[size]} shrink-0 ${className}`.trim()}
    >
      <PhotoTileVisual
        seed={href}
        image={image}
        label={label}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
      />
    </Link>
  );
}
