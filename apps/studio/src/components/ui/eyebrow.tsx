/**
 * WFSC design system — Eyebrow.
 * The little lavender-outlined kicker pill above section headings.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
import { Sparkle } from "@/components/decor";

export function Eyebrow({
  className = "",
  sparkle = true,
  children,
}: {
  className?: string;
  /** Most eyebrows lead with the brand sparkle; pass false to omit it. */
  sparkle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`eyebrow ${className}`.trim()}>
      {sparkle ? <Sparkle size={13} className="text-marigold" /> : null}
      {children}
    </span>
  );
}
