import type { Metadata } from "next";
import { Baloo_2, Quicksand } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${baloo.variable} ${quicksand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-ink/5 bg-cream/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3" aria-label="Warm Fuzzy Story Club home">
              <Image src="/logo.png" alt="Warm Fuzzy Story Club" width={44} height={53} priority />
              <span className="font-display text-lg font-bold leading-tight text-coral">
                Warm Fuzzy
                <span className="block text-xs font-semibold tracking-wide text-ink-soft">
                  Story Club
                </span>
              </span>
            </Link>
            <Link href="/create" className="btn btn-marigold px-5 py-2 text-sm">
              Start your book
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>

        <footer className="mt-16 border-t border-ink/5 bg-cream/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-6 py-8 text-center text-sm text-ink-soft sm:flex-row sm:justify-between sm:text-left">
            <p className="font-display font-semibold text-ink">
              Warm Fuzzy Story Club
            </p>
            <p>Turning memories into art for a lifetime.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
