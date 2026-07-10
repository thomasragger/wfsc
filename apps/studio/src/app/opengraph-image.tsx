import { ImageResponse } from "next/og";

/**
 * Shared social-share card. Next applies this to every route's og:image and
 * twitter:image unless a route overrides it. Fully self-contained: brand colors
 * and a typographic wordmark, no external fetch or bundled fonts.
 */
export const alt = "Warm Fuzzy Story Club: personalized children's books from your memories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "72px",
          textAlign: "center",
          background:
            "radial-gradient(circle at 30% 20%, #ffe6cf 0%, #fffaf7 45%, #fce9ef 100%)",
          color: "#761e0b",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "30px",
            fontWeight: 700,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#ff7916",
          }}
        >
          Warm Fuzzy Story Club
        </div>
        <div
          style={{
            marginTop: "36px",
            fontSize: "92px",
            fontWeight: 800,
            lineHeight: 1.02,
            maxWidth: "980px",
          }}
        >
          Any story. Anywhere. Anyone you love.
        </div>
        <div
          style={{
            marginTop: "34px",
            fontSize: "36px",
            fontWeight: 500,
            color: "#9a4a2a",
            maxWidth: "860px",
          }}
        >
          A one-of-a-kind picture book, written from your own memory.
        </div>
        <div
          style={{
            marginTop: "52px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            background: "#ff7916",
            color: "#ffffff",
            fontSize: "32px",
            fontWeight: 700,
            padding: "18px 44px",
            borderRadius: "999px",
          }}
        >
          Free preview in minutes
        </div>
      </div>
    ),
    size,
  );
}
