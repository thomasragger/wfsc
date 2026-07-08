import Link from "next/link";

import { BookTile } from "@/components/ui/book-tile";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCustomerToken } from "@/lib/customer-session";
import { getCustomerProfile, isCustomerAccountsConfigured, type CustomerProfile } from "@/lib/shopify-customer";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your account — Warm Fuzzy Story Club" };

interface SavedBook {
  token: string;
  title: string | null;
  image: string | null;
  status: string;
}

async function savedBooksFor(email: string): Promise<SavedBook[]> {
  try {
    const { data } = await supabaseAdmin()
      .from("books")
      .select("access_token, title, cover_image_url, mockup_image_url, status, created_at")
      .eq("email", email)
      .eq("is_sample", false)
      .order("created_at", { ascending: false });
    return (data ?? []).map((b) => ({
      token: b.access_token as string,
      title: (b.title ?? null) as string | null,
      image: ((b.mockup_image_url ?? b.cover_image_url) ?? null) as string | null,
      status: b.status as string,
    }));
  } catch {
    return [];
  }
}

export default async function AccountPage() {
  const token = await getCustomerToken();
  let profile: CustomerProfile | null = null;
  if (token) {
    try {
      profile = await getCustomerProfile(token);
    } catch {
      profile = null; // token likely expired — show the signed-out state
    }
  }

  const savedBooks = profile?.email ? await savedBooksFor(profile.email) : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      {profile ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Your account</Eyebrow>
              <h1 className="mt-3 font-display text-4xl font-extrabold text-ink">
                {profile.firstName ? `Hello, ${profile.firstName}` : "Welcome back"}
              </h1>
              {profile.email ? <p className="mt-1 text-ink-soft">{profile.email}</p> : null}
            </div>
            <Link href="/account/logout" className="text-sm font-semibold text-coral hover:underline">
              Sign out
            </Link>
          </div>

          <section className="mt-12">
            <h2 className="font-display text-2xl font-extrabold text-ink">Your books</h2>
            {savedBooks.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 justify-items-center gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                {savedBooks.map((b) => (
                  <BookTile
                    key={b.token}
                    href={`/book/${encodeURIComponent(b.token)}`}
                    image={b.image}
                    title={b.title ?? "Your storybook"}
                    category={b.status === "preview_ready" ? "Preview ready" : b.status.replace(/_/g, " ")}
                    size="md"
                    aspectClassName="aspect-square"
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-ink-soft">
                You haven&rsquo;t made a book yet.{" "}
                <Link href="/create" className="font-semibold text-coral hover:underline">
                  Start your first one.
                </Link>
              </p>
            )}
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl font-extrabold text-ink">Order history</h2>
            {profile.orders.length > 0 ? (
              <ul className="mt-4 divide-y divide-ink/5 rounded-3xl border border-ink/5 bg-white">
                {profile.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="font-display font-bold text-ink">{o.name}</p>
                      {o.processedAt ? (
                        <p className="text-xs text-ink-soft">
                          {new Date(o.processedAt).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                    {o.total ? (
                      <p className="font-display font-extrabold text-ink">
                        {o.total.amount} {o.total.currencyCode}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-ink-soft">No orders yet.</p>
            )}
          </section>
        </>
      ) : (
        <div className="mx-auto max-w-md py-10 text-center">
          <Eyebrow className="mx-auto">Your account</Eyebrow>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Sign in to see your books
          </h1>
          <p className="mt-3 text-ink-soft">
            Your account keeps every book you&rsquo;ve made and every order in one cozy place.
          </p>
          <Card className="mt-8 p-6">
            {isCustomerAccountsConfigured() ? (
              <ButtonLink href="/account/login" size="lg" className="w-full">
                Sign in with Shopify
              </ButtonLink>
            ) : (
              <p className="text-sm text-ink-soft">
                Accounts aren&rsquo;t connected yet. Once the Shopify Customer Account API is set up,
                sign-in will appear here.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
