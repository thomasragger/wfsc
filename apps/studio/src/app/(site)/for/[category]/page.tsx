import { notFound } from "next/navigation";

import { CategoryShowcase } from "@/components/category-showcase";
import { categoryArt } from "@/lib/category-art";
import { loadAudiencePage } from "@/lib/categories";

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
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const data = await loadAudiencePage(category);
  if (!data) notFound();

  const art = categoryArt(data.category.id, data.category.name);
  return (
    <CategoryShowcase
      eyebrow="Gifts they'll never forget"
      title={data.category.name}
      tagline={data.category.tagline}
      heroImageUrl={data.category.heroImageUrl ?? `/categories/${art.photo}.jpg`}
      gradient={{ from: art.from, to: art.to }}
      templates={data.templates}
      backHref="/books"
      backLabel="All books"
    />
  );
}
