/**
 * Shared generative social-share card for a single book (sample or customer).
 * Rendered via next/og ImageResponse in the per-route opengraph-image files:
 * square cover art on the left (fetched by satori from a signed URL), title +
 * customized messaging on the right, brand frame all around. Falls back to a
 * typographic card when the cover isn't painted yet.
 */

export const BOOK_OG_SIZE = { width: 1200, height: 630 };

export function bookShareCard(opts: {
  title: string;
  /** Signed (or public) image URL; null renders the typographic fallback. */
  coverSrc: string | null;
  /** One personalized line under the title. */
  message: string;
  /** Small eyebrow line above the title. */
  eyebrow: string;
  /** Pill at the bottom (call to action / origin note). */
  pill: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: "56px",
        padding: "56px 72px",
        background: "radial-gradient(circle at 30% 20%, #ffe6cf 0%, #fffaf7 45%, #fce9ef 100%)",
        color: "#761e0b",
        fontFamily: "sans-serif",
      }}
    >
      {opts.coverSrc ? (
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            borderRadius: "24px",
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(118, 30, 11, 0.28)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={opts.coverSrc}
            alt=""
            width={470}
            height={470}
            style={{ width: "470px", height: "470px", objectFit: "cover" }}
          />
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: opts.coverSrc ? "flex-start" : "center",
          textAlign: opts.coverSrc ? "left" : "center",
          flexGrow: 1,
        }}
      >
        <div
          style={{
            fontSize: "26px",
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "#ff7916",
          }}
        >
          {opts.eyebrow}
        </div>
        <div
          style={{
            marginTop: "26px",
            fontSize: opts.title.length > 32 ? "58px" : "72px",
            fontWeight: 800,
            lineHeight: 1.05,
            maxWidth: "560px",
          }}
        >
          {opts.title}
        </div>
        <div
          style={{
            marginTop: "24px",
            fontSize: "30px",
            fontWeight: 500,
            lineHeight: 1.35,
            color: "#9a4a2a",
            maxWidth: "540px",
          }}
        >
          {opts.message}
        </div>
        <div
          style={{
            marginTop: "40px",
            display: "flex",
            background: "#ff7916",
            color: "#ffffff",
            fontSize: "26px",
            fontWeight: 700,
            padding: "15px 36px",
            borderRadius: "999px",
          }}
        >
          {opts.pill}
        </div>
      </div>
    </div>
  );
}
