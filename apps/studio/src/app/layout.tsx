import type { Metadata } from "next";
import { Baloo_2, Quicksand } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

import { Doodle, ScallopDefs } from "@/components/decor";

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
        <ScallopDefs />
        <header className="sticky top-0 z-40 border-b border-white/60 bg-cream/70 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2.5"
              aria-label="Warm Fuzzy Story Club home"
            >
              <Image
                src="/logo.png"
                alt=""
                width={40}
                height={48}
                priority
                className="transition-transform duration-300 hover:-rotate-6"
              />
              <span className="font-display text-lg font-extrabold leading-none text-coral">
                Warm Fuzzy
                <span className="mt-0.5 block text-[0.7rem] font-bold uppercase tracking-[0.18em] text-marigold-deep">
                  Story Club
                </span>
              </span>
            </Link>
            <Link href="/create" className="btn btn-coral px-5 py-2.5 text-sm">
              Start your book
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>

        <footer className="relative mt-20 overflow-hidden border-t border-white/60 bg-white/45 backdrop-blur-sm">
          <Doodle src="cloud.png" size={44} className="animate-float absolute right-[8%] top-4 opacity-70" />
          <Doodle src="flower.png" size={26} className="animate-drift absolute left-[6%] bottom-6 opacity-70" />
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-10 text-center text-sm text-ink-soft sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={30} height={36} />
              <p className="font-display font-extrabold text-coral">Warm Fuzzy Story Club</p>
            </div>
            <p className="font-display font-semibold text-ink-soft">
              Turning memories into art for a lifetime.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
