import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { JsonLd, productJsonLd } from "@/components/json-ld";
import { SampleViewer } from "@/components/sample-viewer";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconArrowLeft } from "@/components/ui/icons";
import { PageTransition } from "@/components/ui/page-transition";
import { ProductCard } from "@/components/ui/product-card";
import { fetchSampleBundle, fetchSamples } from "@/lib/samples";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const bundle = await fetchSampleBundle(token);
  if (!bundle) return { title: "Sample book" };
  const { payload } = bundle;
  const title = payload.title ?? "A sample storybook";
  const styleName = payload.style?.name;
  const description = styleName
    ? `A finished sample book, illustrated in the ${styleName} style. Flip through it page by page.`
    : "A finished sample book you can flip through page by page.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `/samples/${token}`,
      // No explicit images: the route's opengraph-image.tsx renders the
      // generative card (cover + title + messaging), which must win here.
    },
  };
}

export default async function SampleBookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bundle = await fetchSampleBundle(token);

  if (!bundle) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-20 sm:px-6">
        <EmptyState
          title="We couldn't find this sample book"
          body="It may have gone back on the shelf. Browse the rest of the library, or start a story of your own."
          action={
            <>
              <ButtonLink href="/samples" variant="ghost">
                Browse sample books
              </ButtonLink>
              <ButtonLink href="/create">Write your story</ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  const { book, payload } = bundle;

  const t = await getTranslations("samples");
  // Other sample books for the "keep browsing" section (best-effort).
  const related = (await fetchSamples().catch(() => []))
    .filter((s) => s.token !== book.access_token)
    .slice(0, 3);

  return (
    <PageTransition className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd
        data={productJsonLd({
          name: payload.title ?? "A sample storybook",
          description: payload.style
            ? `A personalized storybook illustrated in the ${payload.style.name} style.`
            : "A personalized, illustrated storybook.",
          image: payload.coverImageUrl,
          url: `/samples/${book.access_token}`,
        })}
      />
      {/* Everything shares the width of the cover+rail pair (34 + 2 + 20rem),
          so the back button, headline, cover, and cards align on one edge. */}
      <div className="mx-auto w-full lg:max-w-[56rem]">
        <div className="mb-6">
          <ButtonLink href="/samples" variant="ghost" size="sm">
            <IconArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            {t("allSamples")}
          </ButtonLink>
        </div>
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
            {payload.title ?? t("detailFallbackTitle")}
          </h1>
          {payload.style ? (
            <p className="mt-1 text-sm text-ink-soft">
              {t("illustratedIn", { style: payload.style.name })}
            </p>
          ) : null}
        </header>

        <SampleViewer book={payload} suggestedTemplateId={book.template_id} />

        {related.length > 0 ? (
          <section className="mt-16">
            <h2 className="font-display text-2xl font-extrabold text-ink">{t("moreTitle")}</h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
              {related.map((s) => (
                <ProductCard
                  key={s.token}
                  href={`/samples/${encodeURIComponent(s.token)}`}
                  image={s.mockupImageUrl ?? s.coverImageUrl}
                  title={s.title ?? t("detailFallbackTitle")}
                  subtitle={s.templateTagline}
                  tag={s.categoryName}
                  ctaLabel={t("cardCta")}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PageTransition>
  );
}
