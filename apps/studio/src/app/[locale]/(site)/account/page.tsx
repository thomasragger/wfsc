import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/button";
import { ProductCard } from "@/components/ui/product-card";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCustomerRefreshToken, getCustomerToken } from "@/lib/customer-session";
import {
  accountPortalUrl,
  getCustomerProfile,
  isCustomerAccountsConfigured,
  type CustomerProfile,
} from "@/lib/shopify-customer";
import { signUrls } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("metaTitle") };
}

interface SavedBook {
  token: string;
  title: string | null;
  image: string | null;
  coverHasTitle: boolean;
  status: string;
}

async function savedBooksFor(email: string): Promise<SavedBook[]> {
  try {
    const { data } = await supabaseAdmin()
      .from("books")
      .select("access_token, title, cover_image_url, mockup_image_url, cover_has_title, status, created_at")
      .eq("email", email)
      .eq("is_sample", false)
      .order("created_at", { ascending: false });
    // Covers live in the private book-assets bucket: sign before rendering.
    const images = await signUrls(
      (data ?? []).map((b) => ((b.mockup_image_url ?? b.cover_image_url) ?? null) as string | null),
    );
    return (data ?? []).map((b, i) => ({
      token: b.access_token as string,
      title: (b.title ?? null) as string | null,
      image: images[i],
      // Mockups always carry the lettered title; raw covers only sometimes.
      coverHasTitle: Boolean(b.mockup_image_url) || Boolean(b.cover_has_title),
      status: b.status as string,
    }));
  } catch {
    return [];
  }
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default async function AccountPage() {
  const t = await getTranslations("account");
  const token = await getCustomerToken();

  // Access tokens die in ~2h but the refresh cookie lives for 30 days: renew
  // silently instead of showing the sign-in screen to a logged-in customer.
  // Loop-safe: the refresh handler either sets a fresh access token (so this
  // branch won't re-fire) or clears the refresh cookie on failure.
  if (!token && (await getCustomerRefreshToken())) {
    redirect("/account/refresh?next=/account");
  }

  let profile: CustomerProfile | null = null;
  if (token) {
    try {
      profile = await getCustomerProfile(token);
    } catch {
      profile = null; // token rejected — show the signed-out state
    }
  }

  const savedBooks = profile?.email ? await savedBooksFor(profile.email) : [];
  const portalUrl = accountPortalUrl();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      {profile ? (
        <>
          {/* ----------------------------------------------------- header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>{t("eyebrow")}</Eyebrow>
              <h1 className="mt-3 font-display text-4xl font-extrabold text-ink">
                {profile.firstName ? t("helloName", { name: profile.firstName }) : t("welcomeBack")}
              </h1>
              {profile.email ? <p className="mt-1 text-ink-soft">{profile.email}</p> : null}
            </div>
            <ButtonLink href="/account/logout" variant="ghost" size="sm">
              {t("signOut")}
            </ButtonLink>
          </div>

          {/* ------------------------------------------------- your books */}
          <section className="mt-12">
            <h2 className="font-display text-2xl font-extrabold text-ink">{t("yourBooks")}</h2>
            {savedBooks.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                {savedBooks.map((b) => (
                  <ProductCard
                    key={b.token}
                    href={`/book/${encodeURIComponent(b.token)}`}
                    image={b.image}
                    title={b.title ?? t("bookFallbackTitle")}
                    subtitle={b.status === "preview_ready" ? t("previewReady") : humanize(b.status)}
                    ctaLabel={t("openBook")}
                  />
                ))}
              </div>
            ) : (
              <Card className="mt-6 p-6">
                <p className="text-ink-soft">
                  {t("noBookYet")}{" "}
                  <Link href="/create" className="font-semibold text-coral hover:underline">
                    {t("startFirst")}
                  </Link>
                </p>
              </Card>
            )}
          </section>

          {/* ------------------------------------------ orders + address */}
          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <section>
              <h2 className="font-display text-2xl font-extrabold text-ink">{t("orderHistory")}</h2>
              {profile.orders.length > 0 ? (
                <ul className="mt-4 divide-y divide-ink/5 overflow-hidden rounded-3xl border border-ink/5 bg-white shadow-fuzzy">
                  {profile.orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <p className="font-display font-bold text-ink">{o.name}</p>
                          {o.financialStatus ? (
                            <span className="rounded-full bg-sage/20 px-2.5 py-0.5 text-[11px] font-bold text-ink">
                              {humanize(o.financialStatus.toLowerCase())}
                            </span>
                          ) : null}
                        </div>
                        {o.processedAt ? (
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {new Date(o.processedAt).toLocaleDateString()}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-4">
                        {o.total ? (
                          <p className="font-display font-extrabold text-ink">
                            {o.total.amount} {o.total.currencyCode}
                          </p>
                        ) : null}
                        {o.statusPageUrl ? (
                          <a
                            href={o.statusPageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-coral hover:underline"
                          >
                            {t("viewOrder")}
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Card className="mt-4 p-6">
                  <p className="text-ink-soft">{t("noOrders")}</p>
                </Card>
              )}
            </section>

            <aside>
              <h2 className="font-display text-2xl font-extrabold text-ink">{t("addressTitle")}</h2>
              <Card className="mt-4 p-5">
                {profile.address && profile.address.length > 0 ? (
                  <p className="text-sm leading-relaxed text-ink">
                    {profile.address.map((line, i) => (
                      <span key={i} className="block">
                        {line}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-sm text-ink-soft">{t("addressNone")}</p>
                )}
                {portalUrl ? (
                  <>
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block text-sm font-semibold text-coral hover:underline"
                    >
                      {t("manageAccount")}
                    </a>
                    <p className="mt-1 text-xs text-ink-soft">{t("manageAccountNote")}</p>
                  </>
                ) : null}
              </Card>
            </aside>
          </div>
        </>
      ) : isCustomerAccountsConfigured() ? (
        <div className="mx-auto max-w-md py-10 text-center">
          <Eyebrow className="mx-auto">{t("eyebrow")}</Eyebrow>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            {t("signInHeading")}
          </h1>
          <p className="mt-3 text-ink-soft">{t("signInBody")}</p>
          <Card className="mt-8 p-6">
            <ButtonLink href="/account/login" size="lg" className="w-full">
              {t("signInCta")}
            </ButtonLink>
          </Card>
        </div>
      ) : (
        <div className="mx-auto max-w-md py-10 text-center">
          <Eyebrow className="mx-auto">{t("yourBooks")}</Eyebrow>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            {t("inboxHeading")}
          </h1>
          <p className="mt-3 text-ink-soft">{t("inboxBody")}</p>
          <Card className="mt-8 p-6">
            <ButtonLink href="/create" size="lg" className="w-full">
              {t("inboxCta")}
            </ButtonLink>
          </Card>
        </div>
      )}
    </div>
  );
}
