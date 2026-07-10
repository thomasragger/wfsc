import { ImageResponse } from "next/og";

import { loadGoogleFont, loadLogoDataUri, loadSampleMockups } from "@/lib/og-assets";

/**
 * Default social-share card: landscape logo + brand-font headline on the
 * left, a fan of REAL sample-book mockups on the right, brand cream wash.
 * Route-level opengraph-image files (samples/book) override this per page.
 * Every asset loader degrades gracefully, so the card always renders.
 */
export const alt = "Warm Fuzzy Story Club: personalized children's books from your memories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TILTS = ["-9deg", "1deg", "10deg"];

export default async function OpengraphImage() {
  const [baloo, quicksand, logo, mockups] = await Promise.all([
    loadGoogleFont("Baloo 2", 800),
    loadGoogleFont("Quicksand", 600),
    loadLogoDataUri(),
    loadSampleMockups(3),
  ]);

  const fonts = [
    ...(baloo ? [{ name: "Baloo 2", data: baloo, weight: 800 as const }] : []),
    ...(quicksand ? [{ name: "Quicksand", data: quicksand, weight: 600 as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "56px 24px 56px 64px",
          background:
            "radial-gradient(circle at 22% 18%, #ffe6cf 0%, #fffaf7 48%, #fce9ef 100%)",
          color: "#761e0b",
          fontFamily: quicksand ? "Quicksand" : "sans-serif",
        }}
      >
        {/* Left: logo + headline + pill */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            width: "520px",
            flexShrink: 0,
          }}
        >
          {logo ? (
            // Satori needs explicit dimensions (1216x527 source, ratio 2.307).
             
            <img src={logo} alt="" width={330} height={143} style={{ width: "330px", height: "143px" }} />
          ) : (
            <div
              style={{
                fontSize: "34px",
                fontFamily: baloo ? "Baloo 2" : "sans-serif",
                color: "#ff7916",
              }}
            >
              Warm Fuzzy Story Club
            </div>
          )}
          <div
            style={{
              marginTop: "30px",
              fontSize: "54px",
              lineHeight: 1.08,
              fontFamily: baloo ? "Baloo 2" : "sans-serif",
              fontWeight: 800,
              maxWidth: "540px",
            }}
          >
            Any story. Anywhere. Anyone you love.
          </div>
          <div
            style={{
              marginTop: "22px",
              fontSize: "26px",
              lineHeight: 1.4,
              color: "#9a4a2a",
              maxWidth: "500px",
            }}
          >
            A one-of-a-kind picture book, written from your own memory.
          </div>
          <div
            style={{
              marginTop: "36px",
              display: "flex",
              background: "#ff7916",
              color: "#ffffff",
              fontSize: "25px",
              fontWeight: 600,
              padding: "16px 38px",
              borderRadius: "999px",
              boxShadow: "0 10px 26px rgba(255, 121, 22, 0.35)",
            }}
          >
            Free preview in minutes
          </div>
        </div>

        {/* Right: fan of real book mockups */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
            height: "100%",
          }}
        >
          {mockups.map((src, i) => (
             
            <img
              key={i}
              src={src}
              alt=""
              width={300}
              height={300}
              style={{
                width: "250px",
                height: "250px",
                objectFit: "cover",
                borderRadius: "18px",
                transform: `rotate(${TILTS[i % TILTS.length]}) translateY(${i === 1 ? -34 : 26}px)`,
                marginLeft: i === 0 ? 0 : "-78px",
                boxShadow: "0 26px 60px rgba(118, 30, 11, 0.30)",
                border: "6px solid #ffffff",
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
