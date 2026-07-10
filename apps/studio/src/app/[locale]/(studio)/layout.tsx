import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { IconArrowLeft } from "@/components/ui/icons";
import { LanguageSwitcher } from "@/components/language-switcher";

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
  const [t, locale] = await Promise.all([getTranslations("studioChrome"), getLocale()]);
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
          <div className="flex items-center gap-2">
          <LanguageSwitcher current={locale} compact />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-xs font-bold text-ink shadow-sm transition hover:bg-white hover:shadow"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("backToSite")}</span>
            <span className="sm:hidden">{t("back")}</span>
          </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 flex-col">{children}</main>

      <footer className="border-t border-ink/10 bg-cream">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-ink-soft sm:flex-row sm:px-6">
          <p className="font-semibold">{t("footerTagline")}</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-semibold">
            {(["about", "contact", "imprint", "privacy", "terms", "returns"] as const).map((k) => (
              <Link key={k} href={`/${k}`} className="transition-colors hover:text-coral">
                {t(k)}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
