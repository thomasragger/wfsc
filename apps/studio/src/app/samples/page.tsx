import Link from "next/link";

import { ArtPlaceholder, Doodle, Sparkle } from "@/components/decor";
import { fetchSamples, type SampleSummary } from "@/lib/samples";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sample books — Warm Fuzzy Story Club",
  description: "Flip through finished sample books, page by page.",
};

const TILTS = ["-2.5deg", "1.8deg", "-1.2deg", "2.4deg", "-1.8deg", "1.2deg"];

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
        <span className="eyebrow mx-auto">
          <Sparkle size={13} className="text-marigold" />
          Real books, cover to cover
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold text-ink sm:text-5xl">
          Flip through a sample book.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-ink-soft">
          Every book here was made the same way yours will be — a family memory,
          a few photos, and a whole lot of warm fuzzies.
        </p>
      </header>

      {samples.length === 0 ? (
        <div className="card mx-auto mt-12 flex max-w-xl flex-col items-center gap-4 p-12 text-center">
          <Doodle src="cloud.png" size={56} className="animate-float" />
          <p className="font-display text-lg font-extrabold text-ink">
            The first sample books are still at the printer&rsquo;s.
          </p>
          <p className="max-w-md text-sm text-ink-soft">
            Check back very soon — or skip the queue and make a book starring your
            own family.
          </p>
          <Link href="/create" className="btn btn-coral mt-2">
            Write your story
          </Link>
        </div>
      ) : (
        <div className="mt-14 flex flex-col gap-14">
          {[...groups.values()].map((group) => (
            <section key={group.name}>
              <h2 className="font-display text-2xl font-extrabold text-ink">{group.name}</h2>
              <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((sample, i) => (
                  <Link
                    key={sample.token}
                    href={`/samples/${encodeURIComponent(sample.token)}`}
                    className="group flex flex-col rounded-2xl bg-white p-3 pb-2 shadow-polaroid transition-all duration-200 hover:-translate-y-2 hover:!rotate-0"
                    style={{ rotate: TILTS[i % TILTS.length] }}
                  >
                    <div className="aspect-square overflow-hidden rounded-xl bg-lavender">
                      {sample.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sample.coverImageUrl}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <ArtPlaceholder />
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1.5 px-1 pb-1 pt-3 text-center">
                      <p className="font-display text-sm font-extrabold leading-snug text-ink group-hover:text-coral">
                        {sample.title ?? "A sample story"}
                      </p>
                      {sample.categoryName ? (
                        <span className="rounded-full bg-lavender px-2.5 py-0.5 text-[10px] font-bold text-cobalt">
                          {sample.categoryName}
                        </span>
                      ) : null}
                    </div>
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
        <Link href="/create" className="btn btn-coral mt-4">
          Make your own
        </Link>
      </div>
    </div>
  );
}
