import { getTranslations } from "next-intl/server";

import { Doodle } from "@/components/decor";
import { ProductCard } from "@/components/ui/product-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { categoryArt } from "@/lib/category-art";
import { fetchSamples } from "@/lib/samples";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("samples");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function SamplesPage() {
  const [samples, t] = await Promise.all([fetchSamples(), getTranslations("samples")]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="sun.png" size={48} className="animate-drift absolute left-[6%] top-0 hidden sm:block" />
        <Doodle src="cloud.png" size={44} className="animate-float absolute right-[8%] top-6 hidden sm:block" />
        <Eyebrow className="mx-auto">{t("eyebrow")}</Eyebrow>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold text-ink sm:text-5xl">
          {t("heading")}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-ink-soft">{t("intro")}</p>
      </header>

      {samples.length === 0 ? (
        <EmptyState
          className="mt-12"
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={<ButtonLink href="/create">{t("emptyCta")}</ButtonLink>}
        />
      ) : (
        // One fuller grid reads better than one-book-per-category rows.
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {samples.map((sample) => {
            const art = categoryArt(sample.categoryId ?? "kids", sample.categoryName ?? "Kids");
            return (
              <ProductCard
                key={sample.token}
                href={`/samples/${encodeURIComponent(sample.token)}`}
                image={sample.mockupImageUrl ?? sample.coverImageUrl ?? `/categories/${art.photo}.jpg`}
                title={sample.title ?? t("detailFallbackTitle")}
                subtitle={sample.templateTagline}
                tag={sample.categoryName}
                ctaLabel={t("cardCta")}
              />
            );
          })}
        </div>
      )}

      <div className="mt-16 text-center">
        <p className="font-display text-lg font-bold text-ink">{t("closingTitle")}</p>
        <ButtonLink href="/create" className="mt-4">
          {t("closingCta")}
        </ButtonLink>
      </div>
    </div>
  );
}
