/**
 * Shared decorative pieces for the WFSC visual system.
 * Pure SVG/CSS + a handful of brand doodle PNGs. Server-safe.
 */

/* Generated scalloped (bumpy-cloud) squircle paths in a 0..100 box. */
const SCALLOP_CLOUD =
  "M 8 8 A 10.50 10.50 0 0 0 29.00 8.00A 10.50 10.50 0 0 0 50.00 8.00A 10.50 10.50 0 0 0 71.00 8.00A 10.50 10.50 0 0 0 92.00 8.00A 10.50 10.50 0 0 0 92.00 29.00A 10.50 10.50 0 0 0 92.00 50.00A 10.50 10.50 0 0 0 92.00 71.00A 10.50 10.50 0 0 0 92.00 92.00A 10.50 10.50 0 0 0 71.00 92.00A 10.50 10.50 0 0 0 50.00 92.00A 10.50 10.50 0 0 0 29.00 92.00A 10.50 10.50 0 0 0 8.00 92.00A 10.50 10.50 0 0 0 8.00 71.00A 10.50 10.50 0 0 0 8.00 50.00A 10.50 10.50 0 0 0 8.00 29.00A 10.50 10.50 0 0 0 8.00 8.00Z";
const SCALLOP_SHELL =
  "M 8 8 A 14.00 14.00 0 0 0 36.00 8.00A 14.00 14.00 0 0 0 64.00 8.00A 14.00 14.00 0 0 0 92.00 8.00A 8.40 8.40 0 0 0 92.00 24.80A 8.40 8.40 0 0 0 92.00 41.60A 8.40 8.40 0 0 0 92.00 58.40A 8.40 8.40 0 0 0 92.00 75.20A 8.40 8.40 0 0 0 92.00 92.00A 14.00 14.00 0 0 0 64.00 92.00A 14.00 14.00 0 0 0 36.00 92.00A 14.00 14.00 0 0 0 8.00 92.00A 8.40 8.40 0 0 0 8.00 75.20A 8.40 8.40 0 0 0 8.00 58.40A 8.40 8.40 0 0 0 8.00 41.60A 8.40 8.40 0 0 0 8.00 24.80A 8.40 8.40 0 0 0 8.00 8.00Z";
const SCALLOP_COIL =
  "M 8 8 A 8.40 8.40 0 0 0 24.80 8.00A 8.40 8.40 0 0 0 41.60 8.00A 8.40 8.40 0 0 0 58.40 8.00A 8.40 8.40 0 0 0 75.20 8.00A 8.40 8.40 0 0 0 92.00 8.00A 14.00 14.00 0 0 0 92.00 36.00A 14.00 14.00 0 0 0 92.00 64.00A 14.00 14.00 0 0 0 92.00 92.00A 8.40 8.40 0 0 0 75.20 92.00A 8.40 8.40 0 0 0 58.40 92.00A 8.40 8.40 0 0 0 41.60 92.00A 8.40 8.40 0 0 0 24.80 92.00A 8.40 8.40 0 0 0 8.00 92.00A 14.00 14.00 0 0 0 8.00 64.00A 14.00 14.00 0 0 0 8.00 36.00A 14.00 14.00 0 0 0 8.00 8.00Z";

const BLOB_SHAPES = {
  cloud: SCALLOP_CLOUD,
  shell: SCALLOP_SHELL,
  coil: SCALLOP_COIL,
} as const;

export type BlobShape = keyof typeof BLOB_SHAPES;

/**
 * SVG defs mounted once (in the layout). Provides the scallop clip-path used
 * by `.scallop` masked images across the app.
 */
export function ScallopDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <clipPath id="wfsc-scallop" clipPathUnits="objectBoundingBox">
          <path transform="scale(0.01)" d={SCALLOP_CLOUD} />
        </clipPath>
      </defs>
    </svg>
  );
}

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

/** A single brand doodle PNG (sun, cloud, heart, flower, leaf, sparkle). */
export function Doodle({
  src,
  className = "",
  size = 44,
  alt = "",
}: {
  src: string;
  className?: string;
  size?: number;
  alt?: string;
}) {
  const resolved = src.startsWith("/") ? src : `/decor/${src}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      aria-hidden={alt === ""}
      width={size}
      height={size}
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: "auto" }}
      loading="lazy"
    />
  );
}

/**
 * Scattered brand doodles for the hero. Absolutely positioned within a
 * `relative` parent; drifts/twinkles gently and respects reduced motion.
 */
export function DoodleField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Kept clear of the text column: doodles live along the top strip,
          the column gap, and the right / bottom margins. */}
      <Doodle src="cloud.png" size={64} className="animate-float absolute right-[4%] top-[1%] [animation-delay:1.2s]" />
      <Doodle src="cloud.png" size={46} className="animate-float absolute left-[44%] top-[-2%] opacity-80 [animation-delay:0.6s]" />
      <Doodle src="heart-small.png" size={28} className="animate-twinkle absolute right-[30%] top-[3%] [animation-delay:0.7s]" />
      <Doodle src="leaf.png" size={34} className="animate-float absolute left-[47%] top-[44%] [animation-delay:0.3s]" />
      <Doodle src="spark-blue.png" size={24} className="animate-twinkle absolute right-[47%] top-[62%]" />
      <Doodle src="flower.png" size={36} className="animate-drift absolute right-[6%] bottom-[6%] [animation-delay:1.6s]" />
      <Doodle src="sun.png" size={52} className="animate-drift absolute right-[44%] bottom-[4%] [animation-delay:0.4s]" />
      <Doodle src="heart.png" size={30} className="animate-drift absolute left-[2%] bottom-[2%] [animation-delay:0.9s]" />
    </div>
  );
}

/** Small sprinkle of doodles for section corners / celebration moments. */
export function DoodleSprinkle({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <Doodle src="sun.png" size={50} className="animate-drift absolute left-[3%] top-[1%]" />
      <Doodle src="cloud.png" size={46} className="animate-float absolute right-[4%] top-[2%] [animation-delay:0.8s]" />
      <Doodle src="flower.png" size={26} className="animate-drift absolute right-[16%] top-[3%] [animation-delay:1.3s]" />
      <Doodle src="spark-blue.png" size={22} className="animate-twinkle absolute left-[16%] top-[10%]" />
    </div>
  );
}

/**
 * A scalloped gradient-outlined frame housing a mascot / illustration —
 * the "how it works" step shapes. `shape` picks cloud / shell / coil.
 */
export function BlobFrame({
  shape,
  from,
  to,
  children,
  className = "",
}: {
  shape: BlobShape;
  from: string;
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  const d = BLOB_SHAPES[shape];
  const gradId = `blob-${shape}-${from.replace("#", "")}`;
  return (
    <div className={`blob-frame hover-wobble ${className}`}>
      <svg viewBox="0 0 100 100" className="blob-outline" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        {/* echo ring */}
        <path
          d={d}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={2}
          opacity={0.35}
          transform="translate(50 50) scale(1.05) translate(-50 -50)"
        />
        {/* main frame */}
        <path d={d} fill="#ffffff" stroke={`url(#${gradId})`} strokeWidth={4.5} />
      </svg>
      <div className="blob-inner">{children}</div>
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
      <Doodle src="sun.png" size={40} className="animate-drift" />
      {label ? (
        <span className="px-4 text-center text-xs font-semibold text-ink-soft">{label}</span>
      ) : null}
    </div>
  );
}
