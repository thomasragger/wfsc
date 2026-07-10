import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Doodle } from "@/components/decor";
import { BookTile } from "@/components/ui/book-tile";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconArrowLeft } from "@/components/ui/icons";
import type { CategoryTemplate } from "@/lib/categories";

/**
 * Shared layout for a category / browse page: a warm hero band, then a grid
 * of story-idea BookTiles (flat preview at rest, 3D mockup on hover), and a
 * closing CTA. Used by /books, /for/[category] and /occasions/[occasion].
 */
export async function CategoryShowcase({
  title,
  tagline,
  heroImageUrl,
  gradient,
  templates,
  backHref,
  backLabel,
  regionSwitch,
}: {
  title: string;
  tagline: string | null;
  heroImageUrl?: string | null;
  gradient?: { from: string; to: string };
  templates: CategoryTemplate[];
  backHref?: string;
  backLabel?: string;
  regionSwitch?: { current: "dach" | "us"; basePath: string };
}) {
  const t = await getTranslations("categoryShowcase");
  const REGION_TABS: { id: "dach" | "us"; label: string }[] = [
    { id: "dach", label: t("regions.dach") },
    { id: "us", label: t("regions.us") },
  ];
  return (
    <div>
      <section
        className="relative overflow-hidden"
        style={
          gradient
            ? { background: `linear-gradient(150deg, ${gradient.from}, ${gradient.to})` }
            : undefined
        }
      >
        {/* Soft white wash over the saturated gradient so the dark title/
            tagline stay legible. */}
        {gradient ? <div className="absolute inset-0 bg-cream/45" aria-hidden="true" /> : null}
        <div className={`relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 ${gradient ? "" : "flip-wash"}`}>
          <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:items-center lg:gap-10 lg:text-left">
            {heroImageUrl ? (
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full ring-4 ring-white shadow-polaroid sm:h-36 sm:w-36">
                <Image src={heroImageUrl} alt="" width={160} height={160} className="h-full w-full object-cover" />
              </div>
            ) : (
              <Doodle src="sun.png" size={72} className="animate-drift hidden lg:block" />
            )}
            <div>
              {backHref ? (
                <Link
                  href={backHref}
                  className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-bold text-ink shadow-sm ring-1 ring-white/60 transition hover:bg-white"
                >
                  <IconArrowLeft className="h-3.5 w-3.5" /> {backLabel ?? t("back")}
                </Link>
              ) : null}
              <h1 className="font-display text-4xl font-extrabold text-ink sm:text-5xl">{title}</h1>
              {tagline ? <p className="mx-auto mt-3 max-w-xl text-lg font-medium text-ink lg:mx-0">{tagline}</p> : null}
              {regionSwitch ? (
                <div className="mt-5 inline-flex rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-white/60">
                  {REGION_TABS.map((t) => (
                    <Link
                      key={t.id}
                      href={`${regionSwitch.basePath}?region=${t.id}`}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                        regionSwitch.current === t.id
                          ? "bg-coral text-white shadow-sm"
                          : "text-ink/70 hover:text-ink"
                      }`}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {templates.length > 0 ? (
          <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {templates.map((tpl) => (
              <BookTile
                key={tpl.id}
                href={`/create?template=${encodeURIComponent(tpl.id)}`}
                image={tpl.mockupImageUrl ?? tpl.previewImageUrl ?? tpl.exampleImageUrl}
                hoverImage={tpl.mockupImageUrl ? tpl.previewImageUrl : null}
                title={tpl.title}
                tagline={tpl.tagline}
                size="md"
                aspectClassName="aspect-square"
              />
            ))}
          </div>
        ) : (
          <EmptyState
            doodle="sun.png"
            title={t("empty.title")}
            body={t("empty.body")}
            action={<ButtonLink href="/create">{t("empty.action")}</ButtonLink>}
          />
        )}

        <div className="mt-16 text-center">
          <p className="font-display text-lg font-bold text-ink">{t("ctaTitle")}</p>
          <ButtonLink href="/create" size="lg" className="mt-4">
            {t("ctaButton")}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
