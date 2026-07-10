import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, productJsonLd } from "@/components/json-ld";
import { SampleViewer } from "@/components/sample-viewer";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconArrowLeft } from "@/components/ui/icons";
import { PageTransition } from "@/components/ui/page-transition";
import { fetchSampleBundle } from "@/lib/samples";

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
      <header className="mb-10 text-center">
        <Link
          href="/samples"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral hover:underline"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          All sample books
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
          {payload.title ?? "A sample storybook"}
        </h1>
        {payload.style ? (
          <p className="mt-1 text-sm text-ink-soft">
            Illustrated in the <span className="font-semibold">{payload.style.name}</span> style
          </p>
        ) : null}
      </header>

      <SampleViewer book={payload} suggestedTemplateId={book.template_id} />
    </PageTransition>
  );
}
