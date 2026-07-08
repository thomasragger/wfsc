import Link from "next/link";

import { SampleViewer } from "@/components/sample-viewer";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconArrowLeft } from "@/components/ui/icons";
import { PageTransition } from "@/components/ui/page-transition";
import { fetchSampleBundle } from "@/lib/samples";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sample book — Warm Fuzzy Story Club",
};

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
