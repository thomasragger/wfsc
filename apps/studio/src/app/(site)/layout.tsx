import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { loadNavCategories } from "@/lib/categories";

export const dynamic = "force-dynamic";

/** Marketing chrome: announcement bar, category-aware nav, full footer. */
export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { audience, occasions } = await loadNavCategories();

  return (
    <>
      <p className="bg-coral px-4 py-2 text-center text-sm font-medium text-white">
        Just launched: Create your personalized storybook
      </p>

      <SiteNav audience={audience} occasions={occasions} />

      <main className="flex flex-1 flex-col">{children}</main>

      <SiteFooter audience={audience} occasions={occasions} />
    </>
  );
}
