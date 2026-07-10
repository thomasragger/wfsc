import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("errors");
  return {
    title: t("notFound.title"),
    description: t("notFound.description"),
  };
}

/**
 * Root 404 for top-level paths the locale middleware never rewrites (e.g. a
 * bad path with a file extension). Locale-prefixed 404s render the richer
 * `[locale]/not-found.tsx`; this one stays lean but on-brand. It mounts inside
 * the root layout (chrome-free), so no nav/footer data fetch is needed.
 */
export default async function RootNotFound() {
  const t = await getTranslations("errors");
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:py-28"
    >
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
  );
}
