"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { CartButton } from "@/components/cart";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ButtonLink } from "@/components/ui/button";
import { IconChevronDown, IconChevronRight, IconClose, IconMenu, IconUser } from "@/components/ui/icons";
import type { AudienceCategory, OccasionCategory } from "@/lib/categories";

/**
 * WFSC design system — SiteNav.
 * The marketing header: logo, a desktop mega-menu over the audience +
 * occasion categories (hover/focus panels, CSS-driven), and a mobile
 * full-height sheet. All links are internal now (no more deep-links out to
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

  // While the sheet is open: lock body scroll and let Escape close it.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const close = () => setMobileOpen(false);

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
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-ink/5 md:hidden"
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-sheet"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {/* Mobile sheet: full-height below the 3.5rem header, scrollable body with
          a CTA pinned at the bottom. */}
      {mobileOpen ? (
        <div
          id="mobile-nav-sheet"
          className="animate-page-in fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col bg-cream md:hidden"
        >
          <div className="flex-1 space-y-8 overflow-y-auto overscroll-contain px-5 py-6">
            {/* (a) Primary links as large touch rows */}
            <nav aria-label="Primary" className="space-y-1">
              <MobileRow href="/books" onClick={close}>
                {t("ourBooks")}
              </MobileRow>
              <MobileRow href="/for/places" onClick={close}>
                {t("placesYouLove")}
              </MobileRow>
              <MobileRow href="/samples" onClick={close}>
                {t("sampleBooks")}
              </MobileRow>
            </nav>

            {/* (b) Category groups as compact, collapsible chip grids */}
            <MobileGroup
              title={t("whoItsFor")}
              items={audience.map((c) => ({ href: `/for/${c.id}`, label: c.name }))}
              onNavigate={close}
            />
            <MobileGroup
              title={t("occasions")}
              items={occasions.map((c) => ({ href: `/occasions/${c.id}`, label: c.name }))}
              onNavigate={close}
            />

            {/* (d) Language + account access */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/5 pt-6">
              <LanguageSwitcher current={locale} />
              {accountsEnabled ? (
                <Link
                  href="/account"
                  onClick={close}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 font-display font-bold text-ink hover:text-coral"
                >
                  <IconUser className="h-5 w-5" />
                  {t("accountAria")}
                </Link>
              ) : null}
            </div>
          </div>

          {/* (c) CTA pinned at the bottom, always visible */}
          <div className="border-t border-ink/10 bg-cream px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <ButtonLink href="/create" size="lg" className="w-full" onClick={close}>
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

/** A large, thumb-friendly primary link row in the mobile sheet. */
function MobileRow({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-[3.25rem] items-center justify-between rounded-2xl px-4 font-display text-lg font-extrabold text-ink transition-colors hover:bg-lavender/50 active:bg-lavender/60"
    >
      {children}
      <IconChevronRight className="h-5 w-5 text-ink/30" />
    </Link>
  );
}

/**
 * Collapsible category group in the mobile sheet: a tappable header toggles a
 * compact grid of chip-style links, so long taxonomies never become an
 * endless list.
 */
function MobileGroup({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: { href: string; label: string }[];
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between rounded-xl font-display text-xs font-extrabold uppercase tracking-wide text-ink/50"
      >
        {title}
        <IconChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="inline-flex min-h-[44px] items-center rounded-full border-2 border-ink/15 bg-white px-4 font-display text-sm font-bold text-ink transition-colors hover:border-marigold active:border-coral"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
