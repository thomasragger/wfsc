import Image from "next/image";
import Link from "next/link";

import { Doodle } from "@/components/decor";
import { HeroAnimatedBackground } from "@/components/ui/animated-bg";
import { BookTile, BookTileVisual } from "@/components/ui/book-tile";
import { ButtonLink } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PhotoTile } from "@/components/ui/photo-tile";
import { categoryArt } from "@/lib/category-art";
import { fetchSamples } from "@/lib/samples";
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
  sort_order: number;
}

async function loadInspiration(): Promise<{
  categories: CategoryRow[];
  templates: TemplateRow[];
} | null> {
  try {
    const db = supabaseAdmin();
    const [catRes, tplRes] = await Promise.all([
      db
        .from("template_categories")
        .select("id, name, tagline, sort_order")
        .order("sort_order", { ascending: true }),
      db
        .from("story_templates")
        .select("id, category_id, title, tagline, example_image_url, preview_image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);
    if (catRes.error || tplRes.error) return null;
    const categories = (catRes.data ?? []) as CategoryRow[];
    const templates = (tplRes.data ?? []) as TemplateRow[];
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
  const [inspiration, samples] = await Promise.all([loadInspiration(), fetchSamples()]);

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
          {HERO_RIDERS.map((card) => (
            <div
              key={card.caption}
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
              {/* Same visual family as the sample books below — a floating
                  book should look like a book, not a masked category tile. */}
              <div
                className="animate-sway"
                style={{ "--tilt": card.tilt, "--sway": card.sway } as React.CSSProperties}
              >
                {/* A floating book needs a shadow to feel like a physical
                    object — the flat BookTileVisual gets one from the caller. */}
                <BookTileVisual image={card.img} alt={card.caption} className="shadow-polaroid" />
                <p className="pt-2 text-center font-display text-xs font-bold text-ink">
                  {card.caption}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Centered logo + CTA + tagline, exactly like the storefront hero */}
        <div className="relative z-10 mx-auto flex min-h-[54vh] w-full max-w-6xl flex-col items-center justify-center px-4 py-16 text-center sm:min-h-[60vh]">
          <h1 className="m-0">
            <Image
              src="/logo.png"
              alt="Warm Fuzzy Story Club"
              width={300}
              height={355}
              priority
              className="h-auto w-56 drop-shadow-sm sm:w-72"
            />
          </h1>
          <ButtonLink href="/create" size="lg" className="mt-10">
            Write your story
          </ButtonLink>
          <p className="mt-6 font-display text-lg font-bold text-ink sm:text-xl">
            Turn your favorite memory into art for a lifetime
          </p>
        </div>
      </section>

      {/* ------------------------- Flip through a finished book (near the hero) */}
      <section className="flip-wash relative overflow-hidden py-14 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Eyebrow className="mx-auto">See the real thing</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Flip through a finished book.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-soft">
            Every one of these is a real, complete sample book — page by page, the
            same kind you&rsquo;ll hold in your hands.
          </p>
        </div>

        {samples.length > 0 ? (
          // Real book mockups drifting through, echoing the hero. Pauses on
          // hover so a book can be grabbed; the second copy is a seamless
          // loop tail and is hidden from AT / tab order.
          <div className="marquee-fade mt-10 overflow-hidden py-3">
            <div className="animate-marquee flex w-max hover:[animation-play-state:paused]">
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
                    className="mr-6 w-36 shrink-0 sm:mr-8 sm:w-44"
                  >
                    <BookTileVisual
                      image={s.mockupImageUrl ?? s.coverImageUrl ?? `/categories/${art.photo}.jpg`}
                      alt={s.title ?? "A sample story"}
                      className="shadow-polaroid transition-transform duration-300 hover:-translate-y-1.5"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-ink-soft">
            The first sample books are at the printer&rsquo;s — check back very soon.
          </p>
        )}

        <div className="mt-10 text-center">
          <ButtonLink href="/samples">Browse sample books</ButtonLink>
        </div>
      </section>

      {/* --------------------------------------------- Category cards (theme) */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-14 sm:px-6">
        <h2 className="font-display text-[1.7rem] font-bold text-ink sm:text-3xl">
          Gifts for all your favorite people
        </h2>
        {inspiration ? (
          <Carousel className="mt-6" ariaLabel="Gift categories" fullBleed>
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
            title="Our gift categories are still being unpacked."
            body="Come back in a moment — or start straight from your own memory."
            action={<ButtonLink href="/create">Start from your own memory</ButtonLink>}
          />
        )}
      </section>

      {/* --------------------------------------------------- Inspiration gallery */}
      <section id="ideas" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Need a spark?</Eyebrow>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              Start from a story other families love.
            </h2>
            <p className="mt-2 max-w-lg text-ink-soft">
              Pick an idea to begin, then make it entirely yours.
            </p>
          </div>
          <Doodle src="cloud.png" size={54} className="animate-float hidden sm:block" />
        </div>

        {inspiration && inspiration.templates.length > 0 ? (
          <div className="mt-10 flex flex-col gap-12">
            {inspiration.categories.map((cat) => {
              const templates = inspiration.templates.filter((t) => t.category_id === cat.id);
              if (templates.length === 0) return null;
              const art = categoryArt(cat.id, cat.name);
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-4">
                    <div className="scallop h-14 w-14 shrink-0 overflow-hidden sm:h-16 sm:w-16">
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
                  <Carousel className="mt-5" ariaLabel={`${cat.name} story ideas`} itemGap="gap-6" fullBleed>
                    {templates.map((tpl) => (
                      <BookTile
                        key={tpl.id}
                        href={`/create?template=${encodeURIComponent(tpl.id)}`}
                        image={tpl.preview_image_url ?? tpl.example_image_url}
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
            title="Our story ideas are still being tucked in."
            body="Every book here starts with your own memory anyway — days at the beach with grandma, dad's legendary pancakes, a little sister's first snow. Bring yours and we'll take it from there."
            action={<ButtonLink href="/create">Start from your own memory</ButtonLink>}
          />
        )}
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
              Every family has a story worth keeping.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-white/90">
              It takes about five minutes to tell us yours. The book lasts a lifetime.
            </p>
            <ButtonLink href="/create" variant="secondary" size="lg" className="mt-8">
              Write your story
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

