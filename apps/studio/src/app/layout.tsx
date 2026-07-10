import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Baloo_2, Quicksand } from "next/font/google";
import "./globals.css";

import { ScallopDefs } from "@/components/decor";
import { isLaunched, siteUrl } from "@/lib/site-url";
import { PostHogProvider } from "@/components/posthog-provider";

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

// Environment-driven origin + launch gate (see lib/site-url.ts): the real
// domain when NEXT_PUBLIC_SITE_URL is set, the *.vercel.app staging origin
// otherwise — in which case the whole site is noindexed until launch.
const SITE_URL = siteUrl();

// Locale-aware so DACH search snippets and social cards render in German.
export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("rootMeta"), getLocale()]);
  const description = t("description");
  return {
    metadataBase: new URL(SITE_URL),
    ...(isLaunched() ? {} : { robots: { index: false, follow: false } }),
    title: {
      default: t("titleDefault"),
      template: "%s · Warm Fuzzy Story Club",
    },
    description,
    applicationName: "Warm Fuzzy Story Club",
    // Relative canonical resolves per-route against metadataBase, so every page
    // inherits a correct self-referential canonical unless it overrides this.
    alternates: { canonical: "./" },
    openGraph: {
      type: "website",
      siteName: "Warm Fuzzy Story Club",
      title: t("ogTitle"),
      description,
      url: SITE_URL,
      locale: locale === "de" ? "de_DE" : "en",
      // opengraph-image.tsx supplies the shared card image site-wide.
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description,
    },
    // Icons resolve from the app/ file convention (favicon.ico, icon.png,
    // apple-icon.png), so nothing competes with them.
  };
}

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
  const [locale, t] = await Promise.all([getLocale(), getTranslations("chrome")]);
  return (
    <html lang={locale} className={`${baloo.variable} ${quicksand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Skip link: first focusable element, jumps past chrome to #main-content. */}
        <a
          href="#main-content"
          className="sr-only rounded-full bg-coral px-5 py-2.5 font-bold text-white shadow-pop focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
        >
          {t("skipToContent")}
        </a>
        <ScallopDefs />
        <NextIntlClientProvider>
          <PostHogProvider>{children}</PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
