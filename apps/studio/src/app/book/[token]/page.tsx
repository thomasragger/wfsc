import Link from "next/link";

import { BookHub } from "@/components/book-hub";
import { Sparkle } from "@/components/decor";
import { fetchBookBundle, type BookBundle } from "@/lib/books";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your book — Warm Fuzzy Story Club",
};

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
      <Notice
        title="The studio isn't plugged in yet"
        body="This environment is missing its database configuration (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Add it to your environment and reload."
      />
    );
  }

  if (!bundle) {
    return (
      <Notice
        title="We couldn't find this book"
        body="The link may be incomplete — check that you copied the whole address from your email. Or start a brand new story below."
        cta
      />
    );
  }

  return <BookHub token={token} initial={bundle.payload} />;
}

function Notice({ title, body, cta = false }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-20 sm:px-6">
      <div className="card flex flex-col items-center gap-4 p-12 text-center">
        <Sparkle className="text-marigold" size={28} />
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
        {cta ? (
          <Link href="/create" className="btn btn-coral mt-2">
            Start your book
          </Link>
        ) : null}
      </div>
    </div>
  );
}
