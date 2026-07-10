import { Fragment } from "react";

import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Doodle } from "@/components/decor";
import { HeroAnimatedBackground } from "@/components/ui/animated-bg";
import { BookTile, BookTileVisual } from "@/components/ui/book-tile";
import { ButtonLink } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { IconArrowRight, IconChevronDown } from "@/components/ui/icons";
import { PhotoTile } from "@/components/ui/photo-tile";
import { categoryArt } from "@/lib/category-art";
import { loadAudiencePage } from "@/lib/categories";
import { detectRegion, REGION_LABELS } from "@/lib/region";
import { fetchSamples } from "@/lib/samples";
import { resolveLocale } from "@/i18n/request";
import { localizeRow } from "@/lib/i18n-content";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface CategoryRow {
  id: string;
  name: string;
  tagline: string | null;
  sort_order: number;
}

interface TemplateRow {
  id: string;
  category_id: string;
  title: string;
  tagline: string | null;
  example_image_url: string | null;
  preview_image_url: string | null;
  mockup_image_url: string | null;
  sort_order: number;
}

async function loadInspiration(): Promise<{
  categories: CategoryRow[];
  templates: TemplateRow[];
} | null> {
  try {
    const db = supabaseAdmin();
    const locale = await resolveLocale();
    const [catRes, tplRes] = await Promise.all([
      db
        .from("template_categories")
        .select("id, name, tagline, sort_order, translations")
        .order("sort_order", { ascending: true }),
      db
        .from("story_templates")
        .select("id, category_id, title, tagline, example_image_url, preview_image_url, mockup_image_url, sort_order, translations")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);
    if (catRes.error || tplRes.error) return null;
    const categories = (catRes.data ?? []).map((row) => localizeRow(row, locale)) as CategoryRow[];
    const templates = (tplRes.data ?? []).map((row) => localizeRow(row, locale)) as TemplateRow[];
    if (categories.length === 0) return null;
    return { categories, templates };
  } catch {
    return null;
  }
}


/**
 * Hero polaroids rising through the gradient like balloons.
 * Values are hand-varied (not runtime-random) so SSR/CSR markup match.
 * `top` is the resting spot when prefers-reduced-motion disables the ride.
 */
const HERO_RIDERS = [
  {
    img: "/categories/book-1.jpg",
    caption: "Sabine & Aunt Mary",
    side: "left" as const,
    x: "5%",
    top: "0%",
    width: "clamp(6.5rem, 15vw, 13rem)",
    duration: "26s",
    delay: "-3.6s",
    tilt: "-6deg",
    sway: "18px",
    tier: 0,
  },
  {
    img: "/categories/book-3.jpg",
    caption: "Phoebe & Papa",
    side: "right" as const,
    x: "4%",
    top: "8%",
    width: "clamp(6.5rem, 15vw, 13rem)",
    duration: "30s",
    delay: "-2.7s",
    tilt: "5deg",
    sway: "-18px",
    tier: 0,
  },
  {
    img: "/categories/book-2.jpg",
    caption: "Malia & Mama",
    side: "left" as const,
    x: "1%",
    top: "30%",
    width: "clamp(7rem, 13vw, 11.5rem)",
    duration: "34s",
    delay: "-1.7s",
    tilt: "4deg",
    sway: "-14px",
    tier: 1,
  },
  {
    img: "/categories/book.jpg",
    caption: "Theo & Sam",
    side: "right" as const,
    x: "1%",
    top: "30%",
    width: "clamp(7rem, 12.5vw, 11rem)",
    duration: "36s",
    delay: "-14s",
    tilt: "-4deg",
    sway: "12px",
    tier: 1,
  },
  // Second wave — arrives as the first cards drift out of frame.
  {
    img: "/categories/book.jpg",
    caption: "Ruby & Nana",
    side: "left" as const,
    x: "11%",
    top: "0%",
    width: "clamp(7rem, 12vw, 10.5rem)",
    duration: "30s",
    delay: "-15.6s",
    tilt: "3deg",
    sway: "-12px",
    tier: 2,
  },
  {
    img: "/categories/book-1.jpg",
    caption: "Noah & Opa",
    side: "right" as const,
    x: "12%",
    top: "8%",
    width: "clamp(7rem, 12vw, 10.5rem)",
    duration: "34s",
    delay: "-15.7s",
    tilt: "-3deg",
    sway: "14px",
    tier: 2,
  },
];

/** Small doodles drifting up alongside the polaroids. */
const HERO_DOODLES = [
  { src: "sun.png", size: 46, side: "left" as const, x: "20%", top: "10%", duration: "40s", delay: "-6s" },
  { src: "cloud.png", size: 52, side: "left" as const, x: "9%", top: "38%", duration: "46s", delay: "-30s" },
  { src: "heart.png", size: 30, side: "left" as const, x: "26%", top: "70%", duration: "36s", delay: "-19s" },
  { src: "cloud.png", size: 46, side: "right" as const, x: "18%", top: "30%", duration: "44s", delay: "-12s" },
  { src: "heart-small.png", size: 24, side: "right" as const, x: "27%", top: "8%", duration: "34s", delay: "-25s" },
  { src: "flower.png", size: 34, side: "right" as const, x: "9%", top: "78%", duration: "42s", delay: "-38s" },
  { src: "spark-blue.png", size: 22, side: "left" as const, x: "16%", top: "86%", duration: "38s", delay: "-14s" },
  { src: "sun.png", size: 36, side: "right" as const, x: "24%", top: "58%", duration: "48s", delay: "-42s" },
];

export default async function HomePage() {
  const region = await detectRegion();
  const [inspiration, samples, places, t] = await Promise.all([
    loadInspiration(),
    fetchSamples(),
    loadAudiencePage("places", region),
    getTranslations("home"),
  ]);
  const placeTemplates = places?.templates ?? [];
  const axes = t.raw("axes") as { title: string; body: string; cta: string }[];
  const faqs = t.raw("faqs") as { q: string; a: string }[];

  return (
    <div className="w-full">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="hero-wash grain relative overflow-hidden">
        <HeroAnimatedBackground />
        {/* Rising polaroids + doodles */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {HERO_DOODLES.map((d, i) => (
            <div
              key={`d-${i}`}
              className="animate-rise absolute"
              style={{
                [d.side]: d.x,
                top: d.top,
                "--rise-duration": d.duration,
                "--rise-delay": d.delay,
              } as React.CSSProperties}
            >
              <Doodle src={d.src} size={d.size} className="opacity-90" />
            </div>
          ))}
          {HERO_RIDERS.map((card, i) => {
            // Real sample books float through — same square mockups shown in
            // the marquee, so the hero shows the actual product, not stand-ins.
            const book = samples.length ? samples[i % samples.length] : null;
            const img = book?.mockupImageUrl ?? book?.coverImageUrl ?? card.img;
            return (
              <div
                key={i}
                className={`animate-rise absolute ${
                  card.tier === 0
                    ? ""
                    : card.tier === 1
                      ? "hidden sm:block"
                      : "hidden motion-reduce:md:hidden md:block"
                }`}
                style={{
                  [card.side]: card.x,
                  top: card.top,
                  width: card.width,
                  "--rise-duration": card.duration,
                  "--rise-delay": card.delay,
                } as React.CSSProperties}
              >
                <div
                  className="animate-sway"
                  style={{ "--tilt": card.tilt, "--sway": card.sway } as React.CSSProperties}
                >
                  {/* The mockup is a square product shot and already carries
                      its own cover title — show it whole, no extra caption. */}
                  <BookTileVisual
                    image={img}
                    alt={book?.title ?? ""}
                    aspectClassName="aspect-square"
                    className="shadow-polaroid"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Centered logo + CTA + tagline, exactly like the storefront hero */}
        <div className="relative z-10 mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center px-4 py-14 text-center">
          <h1 className="m-0">
            <Image
              src="/logo.png"
              alt={t("heroLogoAlt")}
              width={300}
              height={355}
              priority
              className="h-auto w-56 drop-shadow-sm sm:w-72"
            />
          </h1>
          {/* Keep each sentence intact so it never wraps mid-phrase; breaks fall
              between sentences, so the last one drops to its own line on narrow
              screens (and stays on one line when it fits). Locale-agnostic. */}
          <p className="mt-10 max-w-xl text-balance font-display text-2xl font-extrabold leading-tight text-ink sm:mt-12 sm:text-3xl">
            {t("heroTagline")
              .split(". ")
              .map((part, i, arr) => (i < arr.length - 1 ? `${part}.` : part))
              .map((sentence, i) => (
                <Fragment key={sentence}>
                  {i > 0 ? " " : null}
                  <span className="whitespace-nowrap">{sentence}</span>
                </Fragment>
              ))}
          </p>
          <p className="mt-3 max-w-md text-base text-ink-soft sm:text-lg">
            {t("heroSubtitle")}
          </p>
          <ButtonLink href="/create" size="lg" className="mt-8">
            {t("heroCta")}
          </ButtonLink>
        </div>
      </section>

      {/* ---------------------------------------- What makes it yours (3 axes) */}
      <section className="relative overflow-hidden py-16 sm:py-20">
        {/* soft immersive band behind the trio */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-lavender/40 via-transparent to-transparent" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow className="mx-auto">{t("yoursEyebrow")}</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
              {t("yoursHeadingLine1")}
              <br className="hidden sm:block" /> {t("yoursHeadingLine2")}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-ink-soft">
              {t("yoursIntro")}
            </p>
          </div>

          <div className="mt-20 grid gap-5 sm:grid-cols-3 sm:gap-6">
            {[
              { mascot: "/mascots/story.png", tint: "#efe9ff", href: "/create" },
              { mascot: "/mascots/travel.png", tint: "#e6f3fb", href: "/for/places" },
              { mascot: "/mascots/family.png", tint: "#fce9ef", href: "/samples" },
            ].map((axis, i) => ({ ...axis, ...axes[i] })).map((axis) => (
              <Link
                key={axis.title}
                href={axis.href}
                className="tile-lift group relative flex flex-col items-center rounded-[2rem] px-6 pb-7 pt-14 text-center shadow-fuzzy ring-1 ring-ink/5"
                style={{ backgroundColor: axis.tint }}
              >
                {/* mascot coin, popping over the top edge */}
                <div className="-mt-16 mb-1 h-32 w-32 overflow-hidden rounded-full ring-[6px] ring-white shadow-polaroid transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-3">
                  <Image
                    src={axis.mascot}
                    alt=""
                    width={256}
                    height={256}
                    className="h-full w-full object-cover"
                  />
                </div>
                <h3 className="mt-4 font-display text-2xl font-extrabold text-ink">{axis.title}</h3>
                <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-ink/70">{axis.body}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-coral shadow-sm ring-1 ring-white/60">
                  {axis.cta}
                  <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------- Places you love (region) */}
      {placeTemplates.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <Eyebrow>{t("placesEyebrow")}</Eyebrow>
              <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
                {t("placesHeading")}
              </h2>
              <p className="mt-2 max-w-lg text-ink-soft">
                {t("placesIntro", { region: REGION_LABELS[region] })}
              </p>
            </div>
            <Link
              href="/for/places"
              className="group hidden shrink-0 items-center gap-1.5 text-sm font-bold text-coral sm:inline-flex"
            >
              {t("placesSeeAll")}
              <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <Carousel className="mt-6" ariaLabel={t("placesCarouselAria")} fullBleed>
            {placeTemplates.map((tpl) => (
              <BookTile
                key={tpl.id}
                href={`/create?template=${encodeURIComponent(tpl.id)}`}
                image={tpl.previewImageUrl ?? tpl.exampleImageUrl}
                hoverImage={tpl.mockupImageUrl}
                title={tpl.title}
                tagline={tpl.tagline}
                size="md"
                aspectClassName="aspect-square"
              />
            ))}
          </Carousel>
        </section>
      ) : null}

      {/* --------------------------------------------- Category cards (theme) */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-14 sm:px-6">
        <h2 className="font-display text-[1.7rem] font-bold text-ink sm:text-3xl">
          {t("categoriesHeading")}
        </h2>
        {inspiration ? (
          <Carousel className="mt-6" ariaLabel={t("categoriesCarouselAria")} fullBleed>
            {inspiration.categories.map((cat) => {
              const art = categoryArt(cat.id, cat.name);
              return (
                <PhotoTile
                  key={cat.id}
                  href={`/create?category=${encodeURIComponent(cat.id)}`}
                  image={`/categories/${art.photo}.jpg`}
                  label={cat.name}
                  gradientFrom={art.from}
                  gradientTo={art.to}
                />
              );
            })}
          </Carousel>
        ) : (
          <EmptyState
            className="mt-6"
            title={t("categoriesEmptyTitle")}
            body={t("categoriesEmptyBody")}
            action={<ButtonLink href="/create">{t("categoriesEmptyCta")}</ButtonLink>}
          />
        )}
      </section>

      {/* --------------------------------------------------- Inspiration gallery */}
      <section id="ideas" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Eyebrow>{t("ideasEyebrow")}</Eyebrow>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              {t("ideasHeading")}
            </h2>
            <p className="mt-2 max-w-lg text-ink-soft">
              {t("ideasIntro")}
            </p>
          </div>
          <Doodle src="cloud.png" size={54} className="animate-float hidden sm:block" />
        </div>

        {inspiration && inspiration.templates.length > 0 ? (
          <div className="mt-10 flex flex-col gap-12">
            {inspiration.categories.map((cat) => {
              const templates = inspiration.templates.filter((tpl) => tpl.category_id === cat.id);
              if (templates.length === 0) return null;
              const art = categoryArt(cat.id, cat.name);
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-fuzzy sm:h-16 sm:w-16">
                      <Image
                        src={`/categories/${art.photo}.jpg`}
                        alt=""
                        width={80}
                        height={80}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-extrabold text-ink">{cat.name}</h3>
                      {cat.tagline ? (
                        <p className="text-sm text-ink-soft">{cat.tagline}</p>
                      ) : null}
                    </div>
                  </div>
                  <Carousel className="mt-5" ariaLabel={t("ideasCarouselAria", { name: cat.name })} itemGap="gap-6" fullBleed>
                    {templates.map((tpl) => (
                      <BookTile
                        key={tpl.id}
                        href={`/create?template=${encodeURIComponent(tpl.id)}`}
                        image={tpl.preview_image_url ?? tpl.example_image_url}
                        hoverImage={tpl.mockup_image_url}
                        title={tpl.title}
                        tagline={tpl.tagline}
                        size="lg"
                        aspectClassName="aspect-square"
                      />
                    ))}
                  </Carousel>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            className="mt-10"
            doodle="sun.png"
            title={t("ideasEmptyTitle")}
            body={t("ideasEmptyBody")}
            action={<ButtonLink href="/create">{t("ideasEmptyCta")}</ButtonLink>}
          />
        )}
      </section>

      {/* ---------------------------------------- Flip through a finished book */}
      <section className="flip-wash relative overflow-hidden py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Eyebrow className="mx-auto">{t("flipEyebrow")}</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            {t("flipHeading")}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-soft">
            {t("flipIntro")}
          </p>
        </div>

        {samples.length > 0 ? (
          // Real book mockups drifting through. py-8 gives the edge-fade mask
          // room above/below so a hover-lifted tile + shadow isn't clipped at
          // the top. Pauses on hover; the second copy is a seamless loop tail,
          // hidden from AT / tab order.
          <div className="marquee-fade mt-8 overflow-x-clip py-8">
            <div className="animate-marquee flex w-max items-start hover:[animation-play-state:paused]">
              {[...samples, ...samples].map((s, i) => {
                const art = categoryArt(s.categoryId ?? "kids", s.categoryName ?? "Kids");
                const clone = i >= samples.length;
                return (
                  <Link
                    key={`${s.token}-${i}`}
                    href={`/samples/${encodeURIComponent(s.token)}`}
                    draggable={false}
                    aria-hidden={clone}
                    tabIndex={clone ? -1 : undefined}
                    className="group mr-7 flex w-40 shrink-0 flex-col sm:mr-9 sm:w-48"
                  >
                    <BookTileVisual
                      image={s.mockupImageUrl ?? s.coverImageUrl ?? `/categories/${art.photo}.jpg`}
                      alt={s.title ?? t("sampleFallbackTitle")}
                      aspectClassName="aspect-square"
                      className="shadow-polaroid transition-transform duration-300 group-hover:-translate-y-1.5"
                    />
                    <div className="px-1 pt-4 text-center">
                      <p className="line-clamp-2 font-display text-sm font-extrabold leading-snug text-ink transition-colors group-hover:text-coral">
                        {s.title ?? t("sampleFallbackTitle")}
                      </p>
                      {s.categoryName ? (
                        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-coral/70">
                          {s.categoryName}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-ink-soft">
            {t("flipEmpty")}
          </p>
        )}

        <div className="mt-12 text-center">
          <ButtonLink href="/samples">{t("flipBrowseCta")}</ButtonLink>
        </div>
      </section>

      {/* --------------------------------------------------------------- FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center">
          <Eyebrow className="mx-auto">{t("faqEyebrow")}</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            {t("faqHeading")}
          </h2>
        </div>
        <div className="mt-10 flex flex-col gap-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-3xl bg-white/70 px-6 shadow-fuzzy ring-1 ring-ink/5 transition-colors open:bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-lg font-bold text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <IconChevronDown className="h-5 w-5 shrink-0 text-coral transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="pb-5 leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-ink-soft">
          {t("faqStillCuriousPrefix")}{" "}
          <a
            href="mailto:hello@warmfuzzystoryclub.com"
            className="font-bold text-coral hover:underline"
          >
            {t("faqStillCuriousLink")}
          </a>{" "}
          {t("faqStillCuriousSuffix")}
        </p>
      </section>

      {/* ------------------------------------------------------- Closing CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-coral via-coral to-ember px-8 py-16 text-center shadow-pop sm:px-16">
          <Doodle src="sun.png" size={64} className="animate-drift absolute left-6 top-8 opacity-90" />
          <Doodle src="cloud.png" size={56} className="animate-float absolute right-8 top-10 opacity-90 [animation-delay:0.7s]" />
          <Doodle src="flower.png" size={34} className="animate-drift absolute bottom-10 left-[16%] [animation-delay:1.2s]" />
          <Doodle src="heart-small.png" size={30} className="animate-twinkle absolute bottom-12 right-[18%]" />
          <div className="relative z-10">
            <h2 className="mx-auto max-w-xl font-display text-3xl font-extrabold text-white sm:text-[2.6rem]">
              {t("closingHeading")}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-white/90">
              {t("closingIntro")}
            </p>
            <ButtonLink href="/create" variant="secondary" size="lg" className="mt-8">
              {t("closingCta")}
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

