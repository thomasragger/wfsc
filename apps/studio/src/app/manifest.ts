import type { MetadataRoute } from "next";

/** PWA / install manifest. Brand colors: cream background, coral accent. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Warm Fuzzy Story Club",
    short_name: "Warm Fuzzy",
    description:
      "Turn a real family memory into a one-of-a-kind, beautifully illustrated children's book.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf7",
    theme_color: "#ff7916",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
