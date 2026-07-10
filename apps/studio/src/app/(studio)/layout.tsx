import Image from "next/image";
import Link from "next/link";

import { IconArrowLeft } from "@/components/ui/icons";

/**
 * Focused creator chrome for /create and /book/*: small logo, a quiet way
 * back to the storefront, and a one-line micro-footer. No marketing nav,
 * no full footer — nothing competes with the book being made.
 */
export default function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex w-fit items-center gap-2.5"
            aria-label="Warm Fuzzy Story Club home"
          >
            <Image
              src="/logo-landscape.png"
              alt="Warm Fuzzy Story Club"
              width={1216}
              height={527}
              priority
              className="h-7 w-auto transition-transform duration-300 hover:-rotate-2 sm:h-8"
            />
            <span className="hidden rounded-full bg-lavender/60 px-2.5 py-1 font-display text-xs font-extrabold text-ink sm:block">
              Story Studio
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-xs font-bold text-ink shadow-sm transition hover:bg-white hover:shadow"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to site</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 flex-col">{children}</main>

      <footer className="border-t border-ink/5 py-5 text-center text-xs text-ink-soft">
        <p>Warm Fuzzy Story Club · your story stays private</p>
        <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 font-semibold">
          <Link href="/about" className="hover:text-coral">
            About
          </Link>
          <Link href="/contact" className="hover:text-coral">
            Contact
          </Link>
          <Link href="/imprint" className="hover:text-coral">
            Impressum
          </Link>
          <Link href="/privacy" className="hover:text-coral">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-coral">
            Terms
          </Link>
          <Link href="/returns" className="hover:text-coral">
            Returns
          </Link>
        </nav>
      </footer>
    </>
  );
}
