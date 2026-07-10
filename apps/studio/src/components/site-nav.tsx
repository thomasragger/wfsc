"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { CartButton } from "@/components/cart";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ButtonLink } from "@/components/ui/button";
import { IconChevronDown, IconClose, IconMenu, IconUser } from "@/components/ui/icons";
import type { AudienceCategory, OccasionCategory } from "@/lib/categories";

/**
 * WFSC design system — SiteNav.
 * The marketing header: logo, a desktop mega-menu over the audience +
 * occasion categories (hover/focus panels, CSS-driven), and a mobile
 * slide-down panel. All links are internal now (no more deep-links out to
 * the legacy Liquid theme).
 */
export function SiteNav({
  audience,
  occasions,
  accountsEnabled = false,
}: {
  audience: AudienceCategory[];
  occasions: OccasionCategory[];
  /**
   * Whether Shopify customer accounts are configured. The account link stays
   * hidden until both SHOPIFY_CUSTOMER_ACCOUNT_* vars are set (computed on the
   * server and passed in, since those are not public env vars).
   */
  accountsEnabled?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("nav");
  const locale = useLocale();

  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto grid h-14 w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center justify-self-start" aria-label={t("homeAria")}>
          <Image
            src="/logo-landscape.png"
            alt={t("logoAlt")}
            width={1216}
            height={527}
            priority
            className="h-7 w-auto transition-transform duration-300 hover:-rotate-2 sm:h-8"
          />
        </Link>

        {/* Desktop nav (centered) */}
        <nav aria-label="Main" className="hidden items-center gap-1 justify-self-center md:flex">
          <NavLink href="/books">{t("ourBooks")}</NavLink>
          <MegaItem label={t("whoItsFor")} items={audience.map((c) => ({ href: `/for/${c.id}`, label: c.name, sub: c.tagline }))} />
          <MegaItem label={t("occasions")} items={occasions.map((c) => ({ href: `/occasions/${c.id}`, label: c.name, sub: c.tagline }))} />
          <NavLink href="/for/places">{t("placesYouLove")}</NavLink>
          <NavLink href="/samples">{t("sampleBooks")}</NavLink>
        </nav>

        <div className="flex items-center gap-1 justify-self-end">
          <span className="mr-1 hidden md:inline-flex">
            <LanguageSwitcher current={locale} compact />
          </span>
          {accountsEnabled ? (
            <Link
              href="/account"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-ink/5"
              aria-label={t("accountAria")}
            >
              <IconUser />
            </Link>
          ) : null}
          <CartButton />
          <ButtonLink href="/create" size="sm" className="ml-1 hidden whitespace-nowrap sm:inline-flex sm:px-5">
            {t("writeYourStory")}
          </ButtonLink>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-ink/5 md:hidden"
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen ? (
        <div className="animate-page-in border-t border-ink/5 bg-cream md:hidden">
          {/* Any tap inside (a category link, the CTA) closes the panel. */}
          <div
            className="mx-auto max-h-[calc(100vh-3.5rem)] w-full max-w-7xl space-y-6 overflow-y-auto px-5 py-6"
            onClick={() => setMobileOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <LanguageSwitcher current={locale} />
            </div>
            <MobileSection title={t("browse")}>
              <MobileLink href="/books">{t("ourBooks")}</MobileLink>
              <MobileLink href="/for/places">{t("placesYouLove")}</MobileLink>
              <MobileLink href="/samples">{t("sampleBooks")}</MobileLink>
              <MobileLink href="/create">{t("writeYourStory")}</MobileLink>
            </MobileSection>
            <MobileSection title={t("whoItsFor")}>
              {audience.map((c) => (
                <MobileLink key={c.id} href={`/for/${c.id}`}>
                  {c.name}
                </MobileLink>
              ))}
            </MobileSection>
            <MobileSection title={t("occasions")}>
              {occasions.map((c) => (
                <MobileLink key={c.id} href={`/occasions/${c.id}`}>
                  {c.name}
                </MobileLink>
              ))}
            </MobileSection>
            <ButtonLink href="/create" className="w-full">
              {t("writeYourStory")}
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-2 text-[0.95rem] font-medium text-ink transition-colors hover:text-coral"
    >
      {children}
    </Link>
  );
}

/** Desktop hover/focus mega-panel over a group of category links. */
function MegaItem({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; sub: string | null }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1 rounded-full px-3 py-2 text-[0.95rem] font-medium text-ink transition-colors group-hover:text-coral"
      >
        {label}
        <IconChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
      </button>
      <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-[30rem] max-w-[90vw] rounded-3xl border border-ink/5 bg-white p-3 shadow-polaroid">
          <div className="grid grid-cols-2 gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-4 py-3 transition-colors hover:bg-lavender/50"
              >
                <p className="font-display text-sm font-extrabold text-ink">{item.label}</p>
                {item.sub ? <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">{item.sub}</p> : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-wide text-ink/50">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">{children}</div>
    </div>
  );
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-xl py-2 font-display font-bold text-ink hover:text-coral">
      {children}
    </Link>
  );
}
