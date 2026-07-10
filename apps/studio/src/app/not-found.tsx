import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { AudienceCategory, OccasionCategory } from "@/lib/categories";
import { loadNavCategories } from "@/lib/categories";
import { isCustomerAccountsConfigured } from "@/lib/shopify-customer";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("errors");
  return {
    title: t("notFound.title"),
    description: t("notFound.description"),
  };
}

/**
 * Branded 404. Rendered from the app root (outside the (site) route group),
 * so it mounts the marketing nav + footer itself. Nav categories are best
 * effort: if the lookup fails we still show a full, usable page.
 */
export default async function NotFound() {
  const t = await getTranslations("errors");
  let audience: AudienceCategory[] = [];
  let occasions: OccasionCategory[] = [];
  try {
    ({ audience, occasions } = await loadNavCategories());
  } catch {
    // Fall back to a bare nav rather than turning a 404 into a 500.
  }

  return (
    <>
      <SiteNav audience={audience} occasions={occasions} accountsEnabled={isCustomerAccountsConfigured()} />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:py-28">
        <Image
          src="/mascot/part3.png"
          alt=""
          aria-hidden="true"
          width={180}
          height={180}
          className="h-32 w-auto sm:h-40"
        />
        <Eyebrow className="mx-auto mt-6">{t("notFound.eyebrow")}</Eyebrow>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          {t("notFound.heading")}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-ink-soft">{t("notFound.body")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/">{t("notFound.backHome")}</ButtonLink>
          <ButtonLink href="/books" variant="ghost">
            {t("notFound.browseBooks")}
          </ButtonLink>
        </div>
      </main>

      <SiteFooter audience={audience} occasions={occasions} />
    </>
  );
}
