import { Doodle } from "@/components/decor";
import { BookTile } from "@/components/ui/book-tile";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { categoryArt } from "@/lib/category-art";
import { fetchSamples } from "@/lib/samples";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sample books — Warm Fuzzy Story Club",
  description: "Flip through finished sample books, page by page.",
};

export default async function SamplesPage() {
  const samples = await fetchSamples();

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
        // One fuller grid reads better than one-book-per-category rows.
        <div className="mt-14 grid grid-cols-2 justify-items-center gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {samples.map((sample) => {
            const art = categoryArt(sample.categoryId ?? "kids", sample.categoryName ?? "Kids");
            return (
              <BookTile
                key={sample.token}
                href={`/samples/${encodeURIComponent(sample.token)}`}
                image={sample.mockupImageUrl ?? sample.coverImageUrl ?? `/categories/${art.photo}.jpg`}
                title={sample.title ?? "A sample story"}
                category={sample.categoryName}
                size="md"
                aspectClassName="aspect-square"
              />
            );
          })}
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
