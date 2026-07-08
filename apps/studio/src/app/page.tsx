import Image from "next/image";
import Link from "next/link";

import { ArtPlaceholder, Doodle, Sparkle } from "@/components/decor";
import { fetchSamples, type SampleSummary } from "@/lib/samples";
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
        .select("id, category_id, title, tagline, example_image_url, sort_order")
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

/** Category id -> hero photo + theme card gradient (mirrors the storefront tiles). */
const CATEGORY_ART: Record<string, { photo: string; from: string; to: string }> = {
  babies: { photo: "babies", from: "#F9C5D1", to: "#F0913A" },
  dads: { photo: "dads", from: "#F6B73C", to: "#E8622C" },
  mums: { photo: "mums", from: "#F9C5D1", to: "#E8622C" },
  kids: { photo: "kids", from: "#F6B73C", to: "#F0913A" },
  siblings: { photo: "siblings", from: "#9DB8F0", to: "#2E5FD7" },
  grandparents: { photo: "grandparents", from: "#D9CBF0", to: "#9D8CE8" },
};

function categoryArt(id: string, name: string) {
  if (CATEGORY_ART[id]) return CATEGORY_ART[id];
  const n = name.toLowerCase();
  for (const key of Object.keys(CATEGORY_ART)) {
    if (n.includes(key.slice(0, 3))) return CATEGORY_ART[key];
  }
  return CATEGORY_ART.kids;
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
              <figure
                className="animate-sway rounded-2xl bg-white p-2 pb-1 shadow-polaroid"
                style={{ "--tilt": card.tilt, "--sway": card.sway } as React.CSSProperties}
              >
                <div className="overflow-hidden rounded-xl">
                  <Image
                    src={card.img}
                    alt=""
                    width={280}
                    height={335}
                    priority={false}
                    className="h-auto w-full"
                  />
                </div>
                <figcaption className="px-1 py-1.5 text-center font-display text-[0.8rem] font-bold text-ink">
                  {card.caption}
                </figcaption>
              </figure>
            </div>
          ))}
        </div>

        {/* Centered logo + CTA + tagline, exactly like the storefront hero */}
        <div className="relative z-10 mx-auto flex min-h-[76vh] w-full max-w-6xl flex-col items-center justify-center px-4 py-24 text-center sm:min-h-[82vh]">
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
          <Link href="/create" className="btn btn-coral mt-10 px-8 py-3.5 text-lg">
            Write your story
          </Link>
          <p className="mt-6 font-display text-lg font-bold text-ink sm:text-xl">
            Turn your favorite memory into art for a lifetime
          </p>
        </div>
      </section>

      {/* --------------------------------------------- Category cards (theme) */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-14 sm:px-6">
        <h2 className="font-display text-[1.7rem] font-bold text-ink sm:text-3xl">
          Gifts for all your favorite people
        </h2>
        <div className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {(inspiration?.categories ?? []).map((cat) => {
            const art = categoryArt(cat.id, cat.name);
            return (
              <Link
                key={cat.id}
                href={`/create?category=${encodeURIComponent(cat.id)}`}
                className="group relative aspect-[4/5] w-52 shrink-0 overflow-hidden rounded-3xl shadow-fuzzy transition-transform duration-200 hover:-translate-y-1.5 sm:w-60"
                style={{ background: `linear-gradient(160deg, ${art.from}, ${art.to})` }}
              >
                <div className="scallop absolute inset-[7%] overflow-hidden">
                  <Image
                    src={`/categories/${art.photo}.jpg`}
                    alt={cat.name}
                    width={480}
                    height={600}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <span className="pill-label absolute bottom-4 left-4">{cat.name}</span>
              </Link>
            );
          })}
          {!inspiration ? (
            <div className="card flex w-full items-center justify-center p-10 text-sm text-ink-soft">
              Our gift categories are still being unpacked — come back in a moment.
            </div>
          ) : null}
        </div>
      </section>

      {/* --------------------------------------------------- Inspiration gallery */}
      <section id="ideas" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow">
              <Sparkle size={13} className="text-marigold" />
              Need a spark?
            </span>
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
          <div className="mt-10 flex flex-col gap-14">
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
                  <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                    {templates.map((tpl) => (
                      <Link
                        key={tpl.id}
                        href={`/create?template=${encodeURIComponent(tpl.id)}`}
                        className="group flex flex-col rounded-3xl bg-white/70 p-3 shadow-fuzzy ring-1 ring-white transition-all duration-200 hover:-translate-y-1.5 hover:rotate-[-1.2deg] hover:shadow-polaroid"
                      >
                        <div className="scallop aspect-square overflow-hidden bg-lavender">
                          {tpl.example_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={tpl.example_image_url}
                              alt=""
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <ArtPlaceholder />
                          )}
                        </div>
                        <div className="px-1 pb-1 pt-3 text-center">
                          <p className="font-display text-sm font-extrabold leading-snug text-ink group-hover:text-coral">
                            {tpl.title}
                          </p>
                          {tpl.tagline ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{tpl.tagline}</p>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card mt-10 flex flex-col items-center gap-4 p-10 text-center">
            <Doodle src="sun.png" size={56} className="animate-drift" />
            <p className="max-w-md font-display text-lg font-extrabold text-ink">
              Our story ideas are still being tucked in.
            </p>
            <p className="max-w-md text-sm text-ink-soft">
              Every book here starts with your own memory anyway &mdash; days at the beach with
              grandma, dad&rsquo;s legendary pancakes, a little sister&rsquo;s first snow. Bring
              yours and we&rsquo;ll take it from there.
            </p>
            <Link href="/create" className="btn btn-coral mt-2">
              Start from your own memory
            </Link>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- Sample books */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white/60 p-8 shadow-fuzzy ring-1 ring-white sm:p-12">
          <Doodle src="spark-blue.png" size={24} className="animate-twinkle absolute right-[12%] top-8" />
          <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center">
            <div className="max-w-md">
              <span className="eyebrow">
                <Sparkle size={13} className="text-marigold" />
                See the real thing
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold text-ink">
                Flip through a finished book.
              </h2>
              <p className="mt-2 text-ink-soft">
                These are complete sample books, page by page — the same kind of book
                you&rsquo;ll hold in your hands.
              </p>
              <Link href="/samples" className="btn btn-coral mt-6">
                Browse sample books
              </Link>
            </div>
            {samples.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-5 lg:ml-auto">
                {samples.slice(0, 3).map((s, i) => (
                  <SamplePolaroid key={s.token} sample={s} tilt={i === 1 ? "2deg" : i === 2 ? "-1.5deg" : "-3deg"} />
                ))}
              </div>
            ) : (
              <div className="mx-auto flex flex-col items-center gap-2 text-center lg:ml-auto">
                <Doodle src="cloud.png" size={56} className="animate-float" />
                <p className="max-w-xs text-sm text-ink-soft">
                  The first sample books are at the printer&rsquo;s — check back very soon.
                </p>
              </div>
            )}
          </div>
        </div>
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
            <Link href="/create" className="btn btn-marigold mt-8 text-lg">
              Write your story
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SamplePolaroid({ sample, tilt }: { sample: SampleSummary; tilt: string }) {
  return (
    <Link
      href={`/samples/${encodeURIComponent(sample.token)}`}
      className="group w-36 rounded-2xl bg-white p-2 pb-1 shadow-polaroid transition-all duration-200 hover:-translate-y-1.5 hover:!rotate-0 sm:w-44"
      style={{ rotate: tilt }}
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
      <p className="px-1 pb-1 pt-2 text-center font-display text-xs font-bold leading-snug text-ink">
        {sample.title ?? "A sample story"}
      </p>
      {sample.categoryName ? (
        <p className="pb-1 text-center text-[10px] font-semibold text-ink-soft">{sample.categoryName}</p>
      ) : null}
    </Link>
  );
}
