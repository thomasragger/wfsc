/**
 * WFSC design system — Skeleton.
 * Shimmering lavender placeholder for every async surface (style grids,
 * template cards, book payloads). Size it with className (h-*, aspect-*).
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export function Skeleton({
  className = "",
  rounded = "rounded-2xl",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`animate-shimmer bg-gradient-to-r from-lavender via-white to-lavender ${rounded} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

/** A grid of card-shaped skeletons — the default loader for card grids. */
export function SkeletonGrid({
  count = 4,
  className = "grid gap-4 sm:grid-cols-2",
  itemClassName = "h-40",
}: {
  count?: number;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={className} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={itemClassName} />
      ))}
    </div>
  );
}
