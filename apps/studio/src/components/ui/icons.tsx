/**
 * WFSC design system — Icons.
 * Small stroke-based SVGs (rounded caps, currentColor) replacing raw
 * "←"/"‹" text glyphs — crisp at any size, no font-rendering quirks.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
} as const;

export function IconChevronLeft({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronRight({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowLeft({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M19 12H5M11 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconArrowRight({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
