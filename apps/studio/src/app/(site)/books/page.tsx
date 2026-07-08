import { CategoryShowcase } from "@/components/category-showcase";
import { loadAllTemplates } from "@/lib/categories";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Our books — Warm Fuzzy Story Club",
  description: "Every story idea you can make into a personalized book.",
};

export default async function BooksPage() {
  const templates = await loadAllTemplates();
  return (
    <CategoryShowcase
      eyebrow="The whole library"
      title="Every story, waiting for your family."
      tagline="Pick a story idea and make it yours — your names, your photos, your memory, illustrated cover to cover."
      templates={templates}
    />
  );
}
