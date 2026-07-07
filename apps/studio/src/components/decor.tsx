/**
 * Small decorative pieces shared across pages. Pure SVG/CSS, server-safe.
 */

export function Sparkle({
  className = "",
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 1c.6 4.8 2.4 8.4 4.6 9.9 1.4 1 3.6 1.1 6.4 1.1-2.8 0-5 .2-6.4 1.1C14.4 14.6 12.6 18.2 12 23c-.6-4.8-2.4-8.4-4.6-9.9C6 12.2 3.8 12 1 12c2.8 0 5-.1 6.4-1.1C9.6 9.4 11.4 5.8 12 1z" />
    </svg>
  );
}

export function Dot({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} aria-hidden="true" />;
}

/** Scattered sparkles for hero / celebration moments. */
export function SparkleField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <Sparkle className="absolute left-[8%] top-[18%] animate-twinkle text-marigold" size={22} />
      <Sparkle
        className="absolute right-[12%] top-[10%] animate-twinkle text-coral [animation-delay:0.6s]"
        size={16}
      />
      <Sparkle
        className="absolute left-[18%] bottom-[14%] animate-twinkle text-cobalt [animation-delay:1.1s]"
        size={14}
      />
      <Sparkle
        className="absolute right-[20%] bottom-[24%] animate-twinkle text-sage [animation-delay:1.7s]"
        size={18}
      />
      <Dot className="absolute left-[40%] top-[8%] bg-peach" />
      <Dot className="absolute right-[35%] bottom-[10%] bg-lavender" />
    </div>
  );
}

/** Placeholder art block used wherever a real image hasn't arrived yet. */
export function ArtPlaceholder({
  label,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-lavender via-cream to-peach ${className}`}
    >
      <Sparkle className="text-marigold" size={26} />
      {label ? (
        <span className="px-4 text-center text-xs font-semibold text-ink-soft">{label}</span>
      ) : null}
    </div>
  );
}
