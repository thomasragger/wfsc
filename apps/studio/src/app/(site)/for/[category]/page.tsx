import { notFound } from "next/navigation";

import { CategoryShowcase } from "@/components/category-showcase";
import { categoryArt } from "@/lib/category-art";
import { loadAudiencePage } from "@/lib/categories";
import { detectRegion } from "@/lib/region";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const data = await loadAudiencePage(category);
  if (!data) return { title: "Category — Warm Fuzzy Story Club" };
  return {
    title: `${data.category.name} — Warm Fuzzy Story Club`,
    description: data.category.tagline ?? undefined,
  };
}

export default async function AudienceCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ region?: string }>;
}) {
  const { category } = await params;
  const { region: regionOverride } = await searchParams;
  const region = await detectRegion(regionOverride);
  const data = await loadAudiencePage(category, region);
  if (!data) notFound();

  const art = categoryArt(data.category.id, data.category.name);
  const isPlaces = data.category.id === "places";
  return (
    <CategoryShowcase
      title={data.category.name}
      tagline={data.category.tagline}
      heroImageUrl={isPlaces ? null : data.category.heroImageUrl ?? `/categories/${art.photo}.jpg`}
      gradient={{ from: art.from, to: art.to }}
      templates={data.templates}
      backHref="/books"
      backLabel="All books"
      regionSwitch={isPlaces ? { current: region, basePath: "/for/places" } : undefined}
    />
  );
}
