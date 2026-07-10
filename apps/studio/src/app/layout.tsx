import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Baloo_2, Quicksand } from "next/font/google";
import "./globals.css";

import { ScallopDefs } from "@/components/decor";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "latin-ext"], // latin-ext: German umlauts + ß
  weight: ["500", "600", "700", "800"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Production base URL for absolute metadata (canonical, OG, sitemap). Overridable
 * per environment via NEXT_PUBLIC_SITE_URL; falls back to the live domain.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://warmfuzzystoryclub.com";

const SITE_DESCRIPTION =
  "Turn a real family memory into a one-of-a-kind, beautifully illustrated children's book, starring the people you love. Free preview in minutes, a printed keepsake at your door.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Warm Fuzzy Story Club: personalized children's books from your memories",
    template: "%s · Warm Fuzzy Story Club",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Warm Fuzzy Story Club",
  // Relative canonical resolves per-route against metadataBase, so every page
  // inherits a correct self-referential canonical unless it overrides this.
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: "Warm Fuzzy Story Club",
    title: "Warm Fuzzy Story Club",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en",
    // opengraph-image.tsx supplies the shared card image site-wide.
  },
  twitter: {
    card: "summary_large_image",
    title: "Warm Fuzzy Story Club",
    description: SITE_DESCRIPTION,
  },
  // Icons resolve from the app/ file convention (favicon.ico, icon.png,
  // apple-icon.png), so nothing competes with them.
};

/**
 * Root layout: fonts + global defs only. Page chrome lives in the route
 * groups — (site) carries the marketing header/footer, (studio) the focused
 * creator chrome.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${baloo.variable} ${quicksand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Skip link: first focusable element, jumps past chrome to #main-content. */}
        <a
          href="#main-content"
          className="sr-only rounded-full bg-coral px-5 py-2.5 font-bold text-white shadow-pop focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
        >
          Skip to content
        </a>
        <ScallopDefs />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
