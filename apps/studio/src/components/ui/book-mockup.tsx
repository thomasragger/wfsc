/**
 * WFSC design system — BookMockup.
 * A flat, straight-on hardcover: front cover art, layered page edges on the
 * right, spine hint on the left, soft ground shadow. Hover/focus lifts it
 * straight up off the ground — it never rotates or skews. Use this
 * EVERYWHERE a book appears — a book must read as a physical object, never
 * a flat image.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
import { ArtPlaceholder } from "@/components/decor";

const SIZES = {
  sm: "clamp(7rem, 30vw, 9.5rem)",
  md: "clamp(10rem, 40vw, 14rem)",
  lg: "clamp(13rem, 60vw, 19rem)",
} as const;

export type BookMockupSize = keyof typeof SIZES;

/** Page-edge stack peeking out on the right side of the cover. */
const PAGE_LAYERS = [
  { offset: "1.5%", tone: "#fdf8f2" },
  { offset: "3%", tone: "#fffdf8" },
  { offset: "4.5%", tone: "#f7efe4" },
];

export function BookMockup({
  coverUrl,
  title,
  size = "md",
  className = "",
  alt = "",
  priority = false,
}: {
  coverUrl: string | null;
  /** Rendered as an illustrated stacked title over the cover's upper area. */
  title?: string | null;
  size?: BookMockupSize;
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`book-mockup relative ${className}`.trim()}
      style={{ width: SIZES[size] }}
    >
      <div className="book-mockup-inner aspect-square w-full">
        {/* Page-edge stack (right side) */}
        {PAGE_LAYERS.map((layer, i) => (
          <div
            key={i}
            className="absolute rounded-r-[3%]"
            style={{
              inset: `${1.2 + i * 0.6}% -${layer.offset} ${1.2 + i * 0.6}% auto`,
              width: "20%",
              background: layer.tone,
              boxShadow: "inset -1px 0 0 rgb(118 30 11 / 0.08)",
            }}
            aria-hidden="true"
          />
        ))}

        {/* Front cover */}
        <div
          className="relative h-full w-full overflow-hidden rounded-l-[2.5%] rounded-r-[4.5%] bg-lavender shadow-[0_16px_36px_-14px_rgb(118_30_11/0.45)]"
          style={{ containerType: "inline-size" }}
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={alt}
              className="h-full w-full object-cover"
              loading={priority ? "eager" : "lazy"}
            />
          ) : (
            <ArtPlaceholder />
          )}

          {/* Spine hint — hinge groove + highlight along the left edge */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[7%]"
            style={{
              background:
                "linear-gradient(90deg, rgb(118 30 11 / 0.28) 0%, rgb(118 30 11 / 0.1) 34%, rgb(255 255 255 / 0.28) 62%, rgb(255 255 255 / 0) 100%)",
            }}
            aria-hidden="true"
          />
          {/* Soft sheen so the cover reads as laminated board */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(112deg, rgb(255 255 255 / 0.16) 0%, rgb(255 255 255 / 0) 28%, rgb(118 30 11 / 0) 70%, rgb(118 30 11 / 0.1) 100%)",
            }}
            aria-hidden="true"
          />

          {/* Illustrated title lockup: soft sky scrim so any cover art stays
              legible, bubble-outlined title (matches the wordmark's white-on-ink
              style), tiny sparkle for a hand-finished, storybook feel. */}
          {title ? (
            <>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[42%]"
                style={{
                  background:
                    "linear-gradient(180deg, rgb(118 30 11 / 0.32) 0%, rgb(118 30 11 / 0.1) 55%, transparent 100%)",
                }}
                aria-hidden="true"
              />
              <svg
                className="pointer-events-none absolute right-[6%] top-[4%] h-[9%] w-[9%] text-marigold drop-shadow-[0_1px_2px_rgb(118_30_11/0.35)]"
                viewBox="0 0 40 40"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M20 2c2 8 6 12 14 14-8 2-12 6-14 14-2-8-6-12-14-14 8-2 12-6 14-14z" />
              </svg>
              <p
                className="pointer-events-none absolute inset-x-[9%] top-[5%] m-0 text-balance text-center font-display font-extrabold leading-[1.08] text-white"
                style={{
                  fontSize: "clamp(0.8rem, 10.5cqw, 1.7rem)",
                  textShadow:
                    "-2px -2px 0 #761e0b, 2px -2px 0 #761e0b, -2px 2px 0 #761e0b, 2px 2px 0 #761e0b, 0 4px 8px rgb(118 30 11 / 0.4)",
                }}
              >
                {title}
              </p>
            </>
          ) : null}
        </div>
      </div>

      {/* Ground shadow */}
      <div
        className="book-mockup-ground pointer-events-none absolute -bottom-[7%] left-1/2 h-[9%] w-[86%] -translate-x-1/2 rounded-[50%] bg-ink/25 blur-md"
        aria-hidden="true"
      />
    </div>
  );
}
