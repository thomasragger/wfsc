import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryShowcase } from "@/components/category-showcase";
import { JsonLd, productJsonLd } from "@/components/json-ld";
import { loadOccasionPage } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ occasion: string }>;
}): Promise<Metadata> {
  const { occasion } = await params;
  const data = await loadOccasionPage(occasion);
  if (!data) return { title: "Occasion" };
  const image = data.templates.find((t) => t.previewImageUrl ?? t.mockupImageUrl)?.previewImageUrl;
  const description = data.occasion.tagline ?? undefined;
  return {
    title: data.occasion.name,
    description,
    openGraph: {
      title: data.occasion.name,
      description,
      url: `/occasions/${occasion}`,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ occasion: string }>;
}) {
  const { occasion } = await params;
  const data = await loadOccasionPage(occasion);
  if (!data) notFound();

  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: `${data.occasion.name} personalized storybook`,
          description: data.occasion.tagline,
          image: data.templates.find((t) => t.previewImageUrl)?.previewImageUrl,
          url: `/occasions/${occasion}`,
        })}
      />
      <CategoryShowcase
        title={data.occasion.name}
        tagline={data.occasion.tagline}
        templates={data.templates}
        backHref="/books"
        backLabel="All books"
      />
    </>
  );
}
