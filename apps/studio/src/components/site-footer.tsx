import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { Doodle } from "@/components/decor";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { AudienceCategory, OccasionCategory } from "@/lib/categories";

/** Marketing footer — internal links + a peek at the category axes. */
export async function SiteFooter({
  audience,
  occasions,
}: {
  audience: AudienceCategory[];
  occasions: OccasionCategory[];
}) {
  const [t, locale] = await Promise.all([getTranslations("footer"), getLocale()]);
  return (
    <footer className="relative mt-20 overflow-hidden border-t border-ink/5 bg-white/50 backdrop-blur-sm">
      <Doodle src="cloud.png" size={44} className="animate-float absolute right-[8%] top-4 opacity-70" />
      <Doodle src="flower.png" size={26} className="animate-drift absolute bottom-6 left-[6%] opacity-70" />
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={30} height={36} />
            <p className="font-display font-extrabold text-ink">Warm Fuzzy Story Club</p>
          </div>
          <p className="mt-3 text-sm text-ink-soft">{t("tagline")}</p>
          <div className="mt-4">
            <LanguageSwitcher current={locale} />
          </div>
        </div>

        <FooterCol title={t("explore")}>
          <FooterLink href="/create">{t("writeYourStory")}</FooterLink>
          <FooterLink href="/books">{t("ourBooks")}</FooterLink>
          <FooterLink href="/for/places">{t("placesYouLove")}</FooterLink>
          <FooterLink href="/samples">{t("sampleBooks")}</FooterLink>
          <FooterLink href="/artists">{t("ourArtists")}</FooterLink>
        </FooterCol>

        <FooterCol title={t("whoItsFor")}>
          {audience.slice(0, 6).map((c) => (
            <FooterLink key={c.id} href={`/for/${c.id}`}>
              {c.name}
            </FooterLink>
          ))}
        </FooterCol>

        <FooterCol title={t("occasions")}>
          {occasions.slice(0, 6).map((c) => (
            <FooterLink key={c.id} href={`/occasions/${c.id}`}>
              {c.name}
            </FooterLink>
          ))}
        </FooterCol>

        {/* Legal + trust column (O1). */}
        <FooterCol title={t("legal")}>
          <FooterLink href="/about">{t("aboutUs")}</FooterLink>
          <FooterLink href="/contact">{t("contact")}</FooterLink>
          <FooterLink href="/imprint">{t("imprint")}</FooterLink>
          <FooterLink href="/privacy">{t("privacy")}</FooterLink>
          <FooterLink href="/terms">{t("terms")}</FooterLink>
          <FooterLink href="/returns">{t("returns")}</FooterLink>
        </FooterCol>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-wide text-ink/50">{title}</p>
      <nav className="flex flex-col gap-2 text-sm font-semibold text-ink-soft">{children}</nav>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="hover:text-coral">
      {children}
    </Link>
  );
}
