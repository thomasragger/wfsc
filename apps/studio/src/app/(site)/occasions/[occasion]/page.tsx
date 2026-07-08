import { notFound } from "next/navigation";

import { CategoryShowcase } from "@/components/category-showcase";
import { loadOccasionPage } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ occasion: string }> }) {
  const { occasion } = await params;
  const data = await loadOccasionPage(occasion);
  if (!data) return { title: "Occasion — Warm Fuzzy Story Club" };
  return {
    title: `${data.occasion.name} — Warm Fuzzy Story Club`,
    description: data.occasion.tagline ?? undefined,
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
    <CategoryShowcase
      title={data.occasion.name}
      tagline={data.occasion.tagline}
      templates={data.templates}
      backHref="/books"
      backLabel="All books"
    />
  );
}
