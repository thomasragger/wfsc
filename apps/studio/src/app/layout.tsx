import type { Metadata } from "next";
import { Baloo_2, Quicksand } from "next/font/google";
import "./globals.css";

import { ScallopDefs } from "@/components/decor";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
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
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${baloo.variable} ${quicksand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ScallopDefs />
        {children}
      </body>
    </html>
  );
}
