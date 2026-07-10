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

export const metadata: Metadata = {
  title: "Warm Fuzzy Story Club — Studio",
  description:
    "Turn a family memory into a beautifully illustrated, printed children's book.",
  icons: { icon: "/favicon.png" },
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
        <ScallopDefs />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
