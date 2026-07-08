/**
 * WFSC design system — surfaces.
 *   Card     — frosted white rounded panel (forms, notices, sections)
 *   Polaroid — white-framed photo card with caption slot
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

export function Card({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

/**
 * Polaroid photo card. `media` renders inside the white frame (rounded,
 * clipped); everything else goes below as the handwritten-style caption.
 */
export function Polaroid({
  media,
  caption,
  tilt,
  className = "",
}: {
  media: React.ReactNode;
  caption?: React.ReactNode;
  /** e.g. "-2deg" — polaroids on a table are never perfectly straight. */
  tilt?: string;
  className?: string;
}) {
  return (
    <figure
      className={`m-0 rounded-2xl bg-white p-2 pb-1 shadow-polaroid ${className}`.trim()}
      style={tilt ? { rotate: tilt } : undefined}
    >
      <div className="overflow-hidden rounded-xl">{media}</div>
      {caption ? (
        <figcaption className="px-1 py-1.5 text-center font-display text-[0.8rem] font-bold text-ink">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
