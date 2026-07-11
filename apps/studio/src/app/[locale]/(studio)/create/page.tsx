import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CreateWizard } from "@/components/create-wizard";
import { SkeletonGrid } from "@/components/ui/skeleton";

export async function generateMetadata() {
  const t = await getTranslations("createPage");
  return { title: t("metaTitle") };
}

export default function CreatePage() {
  return (
    // On lg+ this page fills the studio layout's bounded <main> exactly (no
    // body scroll): the wizard becomes a fixed workspace between header and
    // footer. Normal document flow below lg.
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:pb-14 sm:pt-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:py-3">
      <Suspense
        fallback={
          <SkeletonGrid count={2} className="grid gap-6" itemClassName="h-48 rounded-3xl" />
        }
      >
        <CreateWizard />
      </Suspense>
    </div>
  );
}
