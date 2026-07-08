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

const NAV_LINKS = [
  { label: "Our Books", href: "https://www.warmfuzzystoryclub.com/collections/all", external: true },
  { label: "Make Your Own", href: "/create", external: false },
  { label: "How It Works", href: "https://www.warmfuzzystoryclub.com/pages/how-it-works", external: true },
  { label: "About", href: "https://www.warmfuzzystoryclub.com/pages/about", external: true },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${baloo.variable} ${quicksand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ScallopDefs />

        {/* Announcement bar — mirrors the theme storefront */}
        <p className="bg-coral px-4 py-2 text-center text-sm font-medium text-white">
          Just launched: Create your personalized storybook
        </p>

        <header className="sticky top-0 z-40 border-b border-ink/5 bg-cream/85 backdrop-blur-md">
          <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
            <Link
              href="/"
              className="flex w-fit items-center"
              aria-label="Warm Fuzzy Story Club home"
            >
              <Image
                src="/logo.png"
                alt="Warm Fuzzy Story Club"
                width={38}
                height={45}
                priority
                className="transition-transform duration-300 hover:-rotate-6"
              />
            </Link>

            <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
              {NAV_LINKS.map((link) =>
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-[0.95rem] font-medium text-ink transition-colors hover:text-coral"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-[0.95rem] font-medium text-ink transition-colors hover:text-coral"
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </nav>

            <div className="flex items-center justify-end">
              <Link href="/create" className="btn btn-coral px-4 py-2 text-sm sm:px-5">
                Write your story
              </Link>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>

        <footer className="relative mt-20 overflow-hidden border-t border-ink/5 bg-white/50 backdrop-blur-sm">
          <Doodle src="cloud.png" size={44} className="animate-float absolute right-[8%] top-4 opacity-70" />
          <Doodle src="flower.png" size={26} className="animate-drift absolute left-[6%] bottom-6 opacity-70" />
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-6 py-10 text-center text-sm text-ink-soft sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={30} height={36} />
              <p className="font-display font-extrabold text-ink">Warm Fuzzy Story Club</p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-semibold">
              <Link href="/create" className="hover:text-coral">Make your own</Link>
              <Link href="/samples" className="hover:text-coral">Sample books</Link>
              <a href="https://www.warmfuzzystoryclub.com/collections/all" className="hover:text-coral">Our books</a>
              <a href="https://www.warmfuzzystoryclub.com/pages/about" className="hover:text-coral">About</a>
            </nav>
            <p className="font-display font-semibold">
              Turning memories into art for a lifetime.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
