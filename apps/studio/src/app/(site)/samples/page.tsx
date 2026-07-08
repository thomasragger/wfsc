import Link from "next/link";

import { Doodle } from "@/components/decor";
import { BookMockup } from "@/components/ui/book-mockup";
import { ButtonLink } from "@/components/ui/button";
import { Tag } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { fetchSamples, type SampleSummary } from "@/lib/samples";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sample books — Warm Fuzzy Story Club",
  description: "Flip through finished sample books, page by page.",
};

export default async function SamplesPage() {
  const samples = await fetchSamples();

  // Group by category, keeping first-seen order; uncategorized last.
  const groups = new Map<string, { name: string; items: SampleSummary[] }>();
  for (const sample of samples) {
    const key = sample.categoryId ?? "other";
    const name = sample.categoryName ?? "More stories";
    if (!groups.has(key)) groups.set(key, { name, items: [] });
    groups.get(key)!.items.push(sample);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="sun.png" size={48} className="animate-drift absolute left-[6%] top-0 hidden sm:block" />
        <Doodle src="cloud.png" size={44} className="animate-float absolute right-[8%] top-6 hidden sm:block" />
        <Eyebrow className="mx-auto">Real books, cover to cover</Eyebrow>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold text-ink sm:text-5xl">
          Flip through a sample book.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-ink-soft">
          Every book here was made the same way yours will be — a family memory,
          a few photos, and a whole lot of warm fuzzies.
        </p>
      </header>

      {samples.length === 0 ? (
        <EmptyState
          className="mt-12"
          title="The first sample books are still at the printer's."
          body="Check back very soon — or skip the queue and make a book starring your own family."
          action={<ButtonLink href="/create">Write your story</ButtonLink>}
        />
      ) : (
        <div className="mt-14 flex flex-col gap-14">
          {[...groups.values()].map((group) => (
            <section key={group.name}>
              <h2 className="font-display text-2xl font-extrabold text-ink">{group.name}</h2>
              <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((sample) => (
                  <Link
                    key={sample.token}
                    href={`/samples/${encodeURIComponent(sample.token)}`}
                    className="group flex flex-col items-center gap-3"
                  >
                    <BookMockup
                      coverUrl={sample.coverImageUrl}
                      title={sample.title ?? "A sample story"}
                      size="sm"
                      alt={sample.title ?? "A sample story"}
                      className="mx-auto"
                    />
                    <span className="flex flex-col items-center gap-1.5 text-center">
                      <span className="font-display text-sm font-extrabold leading-snug text-ink group-hover:text-coral">
                        {sample.title ?? "A sample story"}
                      </span>
                      {sample.categoryName ? <Tag>{sample.categoryName}</Tag> : null}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-16 text-center">
        <p className="font-display text-lg font-bold text-ink">
          Ready to see your own family in one of these?
        </p>
        <ButtonLink href="/create" className="mt-4">
          Make your own
        </ButtonLink>
      </div>
    </div>
  );
}
