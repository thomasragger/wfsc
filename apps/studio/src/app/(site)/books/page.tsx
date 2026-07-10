import { getTranslations } from "next-intl/server";

import { CategoryShowcase } from "@/components/category-showcase";
import { loadAllTemplates } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("booksPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function BooksPage() {
  const [templates, t] = await Promise.all([
    loadAllTemplates(),
    getTranslations("booksPage"),
  ]);
  return (
    <CategoryShowcase title={t("title")} tagline={t("tagline")} templates={templates} />
  );
}
