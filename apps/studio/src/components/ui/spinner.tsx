/**
 * WFSC design system — Spinner.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

const SIZES = { sm: 16, md: 22, lg: 32 } as const;

export type SpinnerSize = keyof typeof SIZES;

/** Circular pending indicator. Inherits `currentColor`, so it adapts to any button. */
export function Spinner({
  size = "md",
  className = "",
  label,
}: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  const px = SIZES[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
