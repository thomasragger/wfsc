import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { IconArrowLeft } from "@/components/ui/icons";

/**
 * Focused creator chrome for /create and /book/*: small logo, a quiet way
 * back to the storefront, and a one-line micro-footer. No marketing nav,
 * no full footer — nothing competes with the book being made.
 */
export default async function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = await getTranslations("studioChrome");
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex w-fit items-center gap-2.5"
            aria-label={t("homeAria")}
          >
            <Image
              src="/logo-landscape.png"
              alt={t("logoAlt")}
              width={1216}
              height={527}
              priority
              className="h-7 w-auto transition-transform duration-300 hover:-rotate-2 sm:h-8"
            />
            <span className="hidden rounded-full bg-lavender/60 px-2.5 py-1 font-display text-xs font-extrabold text-ink sm:block">
              {t("badge")}
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-xs font-bold text-ink shadow-sm transition hover:bg-white hover:shadow"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("backToSite")}</span>
            <span className="sm:hidden">{t("back")}</span>
          </Link>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 flex-col">{children}</main>

      <footer className="border-t border-ink/5 py-5 text-center text-xs text-ink-soft">
        <p>{t("footerTagline")}</p>
        <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 font-semibold">
          <Link href="/about" className="hover:text-coral">
            {t("about")}
          </Link>
          <Link href="/contact" className="hover:text-coral">
            {t("contact")}
          </Link>
          <Link href="/imprint" className="hover:text-coral">
            {t("imprint")}
          </Link>
          <Link href="/privacy" className="hover:text-coral">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-coral">
            {t("terms")}
          </Link>
          <Link href="/returns" className="hover:text-coral">
            {t("returns")}
          </Link>
        </nav>
      </footer>
    </>
  );
}
