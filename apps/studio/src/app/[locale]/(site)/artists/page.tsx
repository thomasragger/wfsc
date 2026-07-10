import { getTranslations } from "next-intl/server";

import { Eyebrow } from "@/components/ui/eyebrow";
import { ButtonLink } from "@/components/ui/button";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("artists");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

interface StyleRow {
  id: string;
  name: string;
  reference_image_urls: string[] | null;
}

export default async function StylesPage() {
  const t = await getTranslations("artists");
  /** Customer-facing blurb per style (the DB style_prompt is model-only). */
  const STYLE_COPY = t.raw("styleCopy") as Record<string, string>;

  let styles: StyleRow[] = [];
  try {
    const { data } = await supabaseAdmin()
      .from("styles")
      .select("id, name, reference_image_urls, sort_order")
      .order("sort_order", { ascending: true });
    styles = (data ?? []) as StyleRow[];
  } catch {
    styles = [];
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <Eyebrow className="mx-auto">{t("eyebrow")}</Eyebrow>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          {t("heading")}
        </h1>
        <p className="mx-auto mt-4 text-ink-soft">{t("intro")}</p>
      </header>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {styles.map((style) => {
          const refs = (style.reference_image_urls ?? []).slice(0, 3);
          return (
            <article
              key={style.id}
              className="overflow-hidden rounded-3xl bg-white/70 shadow-fuzzy ring-1 ring-ink/5"
            >
              {refs.length > 0 ? (
                <div className="grid grid-cols-3 gap-0.5 bg-cream">
                  {refs.map((src, i) => (
                    <div key={i} className="aspect-square overflow-hidden">
                      <ProgressiveImage
                        src={src}
                        alt={t("sampleArtAlt", { name: style.name })}
                        className="h-full w-full"
                        imgClassName="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="p-5">
                <h2 className="font-display text-xl font-extrabold text-ink">{style.name}</h2>
                <p className="mt-1.5 text-sm text-ink-soft">
                  {STYLE_COPY[style.id] ?? t("styleFallback")}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-16 rounded-3xl bg-marigold/15 p-8 text-center">
        <p className="font-display text-xl font-extrabold text-ink">{t("illustratorTitle")}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{t("illustratorBody")}</p>
        <ButtonLink href="mailto:hello@warmfuzzystoryclub.com?subject=Artist%20collaboration" size="lg" className="mt-5">
          {t("illustratorCta")}
        </ButtonLink>
      </section>

      <div className="mt-12 text-center">
        <ButtonLink href="/create" size="lg">
          {t("startCta")}
        </ButtonLink>
      </div>
    </div>
  );
}
