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
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex w-fit items-center gap-2.5"
            aria-label="Warm Fuzzy Story Club home"
          >
            <Image
              src="/logo.png"
              alt=""
              width={32}
              height={38}
              priority
              className="transition-transform duration-300 hover:-rotate-6"
            />
            <span className="hidden font-display text-sm font-extrabold text-ink sm:block">
              Story Studio
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft transition-colors hover:text-coral"
          >
            <IconArrowLeft className="h-3 w-3" />
            back to warmfuzzystoryclub.com
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer className="border-t border-ink/5 py-4 text-center text-xs text-ink-soft">
        <p>
          Warm Fuzzy Story Club · your story stays private ·{" "}
          <a href="https://www.warmfuzzystoryclub.com/pages/about" className="font-semibold hover:text-coral">
            about us
          </a>
        </p>
      </footer>
    </>
  );
}
