import Link from "next/link";

import { Sparkle } from "@/components/decor";
import { SampleViewer } from "@/components/sample-viewer";
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
        <div className="card flex flex-col items-center gap-4 p-12 text-center">
          <Sparkle className="text-marigold" size={28} />
          <h1 className="font-display text-2xl font-bold text-ink">
            We couldn&rsquo;t find this sample book
          </h1>
          <p className="text-sm leading-relaxed text-ink-soft">
            It may have gone back on the shelf. Browse the rest of the library,
            or start a story of your own.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/samples" className="btn btn-ghost">
              Browse sample books
            </Link>
            <Link href="/create" className="btn btn-coral">
              Write your story
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { book, payload } = bundle;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 text-center">
        <Link href="/samples" className="text-sm font-semibold text-coral hover:underline">
          ← All sample books
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
    </div>
  );
}
