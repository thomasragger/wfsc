import { BookHub } from "@/components/book-hub";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { captureServer } from "@/lib/analytics";
import { fetchBookBundle, type BookBundle } from "@/lib/books";

export const dynamic = "force-dynamic";

/**
 * Private page (capability URL): personalized title/OG for the share preview
 * when customers send their link to family, but explicitly noindex so a
 * shared link never lands the book in a search index (robots.txt disallow
 * alone doesn't prevent indexing of externally-linked URLs).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bundle = await fetchBookBundle(token).catch(() => null);
  const de = bundle?.book.locale === "de";
  const title = bundle?.payload.title ?? "Your book";
  const description = de
    ? "Ein einzigartiges Bilderbuch aus einer echten Familienerinnerung."
    : "A one-of-a-kind picture book made from a real family memory.";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "book" },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let bundle: BookBundle | null = null;
  let configured = true;
  try {
    bundle = await fetchBookBundle(token);
  } catch {
    configured = false;
  }

  if (!configured) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-20 sm:px-6">
        <EmptyState
          title="The studio isn't plugged in yet"
          body="This environment is missing its database configuration (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Add it to your environment and reload."
        />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-20 sm:px-6">
        <EmptyState
          title="We couldn't find this book"
          body="The link may be incomplete — check that you copied the whole address from your email. Or start a brand new story below."
          action={<ButtonLink href="/create">Start your book</ButtonLink>}
        />
      </div>
    );
  }

  // Funnel: distinguish the free-preview view from the paid review view
  // (keyed on book id, no PII). Fired on each server render of the page.
  const status = bundle.book.status;
  if (status === "preview_ready") {
    await captureServer("preview_viewed", bundle.book.id, { status });
  } else if (status === "ready_for_review") {
    await captureServer("review_page_opened", bundle.book.id, { status });
  }

  return <BookHub token={token} initial={bundle.payload} />;
}
