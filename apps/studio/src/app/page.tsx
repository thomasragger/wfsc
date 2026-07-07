import Link from "next/link";

import { ArtPlaceholder, Sparkle, SparkleField } from "@/components/decor";
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
    if (categories.length === 0 || templates.length === 0) return null;
    return { categories, templates };
  } catch {
    return null;
  }
}

const STEPS = [
  {
    n: 1,
    title: "Tell us your story",
    body: "A trip to the sea, pancake Sundays, the day the training wheels came off. Write it the way you'd tell it at bedtime.",
    color: "bg-coral text-cream",
  },
  {
    n: 2,
    title: "Upload your pictures",
    body: "A few photos of the people in your story. Our illustrators turn them into storybook characters that are unmistakably them.",
    color: "bg-marigold text-ink",
  },
  {
    n: 3,
    title: "Experience the magic",
    body: "Watch your memory become a fully illustrated picture book, then hold the printed copy in your hands.",
    color: "bg-cobalt text-cream",
  },
];

const HERO_POLAROIDS = [
  {
    caption: "Nana's lighthouse",
    rotate: "-rotate-6",
    art: (
      <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden="true">
        <rect width="160" height="160" fill="#ECE5F8" />
        <circle cx="122" cy="38" r="20" fill="#F6B73C" />
        <path d="M0 118 Q40 92 80 112 T160 106 V160 H0 Z" fill="#7FA678" />
        <rect x="66" y="52" width="28" height="60" rx="4" fill="#E8622C" />
        <rect x="70" y="42" width="20" height="14" rx="3" fill="#2E5FD7" />
      </svg>
    ),
  },
  {
    caption: "Papa's pancake day",
    rotate: "rotate-3",
    art: (
      <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden="true">
        <rect width="160" height="160" fill="#FBE3CB" />
        <ellipse cx="80" cy="112" rx="52" ry="14" fill="#E8622C" />
        <ellipse cx="80" cy="102" rx="52" ry="14" fill="#F6B73C" />
        <ellipse cx="80" cy="92" rx="52" ry="14" fill="#DD9C1B" />
        <circle cx="80" cy="44" r="16" fill="#2E5FD7" />
        <path d="M64 44 q16 18 32 0" stroke="#FFFDF8" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    caption: "Our first snow",
    rotate: "-rotate-2",
    art: (
      <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden="true">
        <rect width="160" height="160" fill="#2E5FD7" />
        <circle cx="34" cy="34" r="4" fill="#FFFDF8" />
        <circle cx="120" cy="24" r="3" fill="#FFFDF8" />
        <circle cx="88" cy="52" r="3.5" fill="#FFFDF8" />
        <circle cx="140" cy="70" r="4" fill="#FFFDF8" />
        <circle cx="80" cy="118" r="26" fill="#FFFDF8" />
        <circle cx="80" cy="82" r="18" fill="#FFFDF8" />
        <circle cx="76" cy="78" r="2.4" fill="#2B2320" />
        <circle cx="86" cy="78" r="2.4" fill="#2B2320" />
        <path d="M78 86 l8 2 -8 2 z" fill="#E8622C" />
      </svg>
    ),
  },
];

export default async function HomePage() {
  const inspiration = await loadInspiration();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
        <SparkleField />
        <div className="relative z-10 flex flex-col items-start gap-6">
          <p className="rounded-full bg-lavender px-4 py-1.5 text-sm font-semibold text-cobalt">
            A storybook starring your family
          </p>
          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Turning memories into <span className="text-coral">art</span> for a lifetime.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft">
            Tell us about a day you never want to forget. We turn it into a beautifully
            illustrated, printed children&rsquo;s book — with your family as the heroes.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/create" className="btn btn-coral text-lg">
              Start your book
            </Link>
            <a href="#ideas" className="btn btn-ghost">
              Browse story ideas
            </a>
          </div>
        </div>

        <div className="relative z-10 mx-auto flex max-w-md items-center justify-center py-6">
          <div className="flex items-start -space-x-3">
            {HERO_POLAROIDS.map((p, i) => (
              <figure
                key={p.caption}
                className={`polaroid w-32 shrink-0 sm:w-40 ${p.rotate} ${
                  i === 1 ? "z-10 -translate-y-8 animate-float" : i === 2 ? "translate-y-4" : ""
                }`}
              >
                <div className="aspect-square overflow-hidden rounded-sm">{p.art}</div>
                <figcaption className="pt-2 text-center text-xs font-semibold text-ink-soft">
                  {p.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 sm:py-16">
        <h2 className="font-display text-3xl font-bold text-ink sm:text-4xl">How it works</h2>
        <p className="mt-2 max-w-lg text-ink-soft">
          From a memory at the kitchen table to a hardcover on the shelf, in three steps.
        </p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="card flex flex-col gap-4 p-7">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full font-display text-lg font-bold ${step.color}`}
              >
                {step.n}
              </span>
              <h3 className="font-display text-xl font-bold text-ink">{step.title}</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Inspiration gallery */}
      <section id="ideas" className="scroll-mt-24 py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-ink sm:text-4xl">
              Need a spark?
            </h2>
            <p className="mt-2 max-w-lg text-ink-soft">
              Start from a story idea other families love, then make it entirely yours.
            </p>
          </div>
          <Sparkle className="hidden text-marigold sm:block" size={32} />
        </div>

        {inspiration ? (
          <div className="mt-10 flex flex-col gap-12">
            {inspiration.categories.map((cat) => {
              const templates = inspiration.templates.filter((t) => t.category_id === cat.id);
              if (templates.length === 0) return null;
              return (
                <div key={cat.id}>
                  <h3 className="font-display text-xl font-bold text-ink">{cat.name}</h3>
                  {cat.tagline ? <p className="text-sm text-ink-soft">{cat.tagline}</p> : null}
                  <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                    {templates.map((tpl, i) => (
                      <Link
                        key={tpl.id}
                        href={`/create?template=${encodeURIComponent(tpl.id)}`}
                        className={`polaroid group transition-transform duration-200 hover:z-10 hover:rotate-0 hover:scale-105 ${
                          i % 3 === 0 ? "-rotate-2" : i % 3 === 1 ? "rotate-1" : "rotate-2"
                        }`}
                      >
                        <div className="aspect-square overflow-hidden rounded-sm bg-lavender">
                          {tpl.example_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={tpl.example_image_url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <ArtPlaceholder />
                          )}
                        </div>
                        <div className="pt-2 text-center">
                          <p className="font-display text-sm font-bold leading-snug text-ink group-hover:text-coral">
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
            <Sparkle className="animate-twinkle text-marigold" size={30} />
            <p className="max-w-md font-display text-lg font-bold text-ink">
              Our story ideas are still being tucked in.
            </p>
            <p className="max-w-md text-sm text-ink-soft">
              Every book here starts with your own memory anyway — days at the beach with
              grandma, dad&rsquo;s legendary pancakes, a little sister&rsquo;s first snow. Bring
              yours and we&rsquo;ll take it from there.
            </p>
            <Link href="/create" className="btn btn-marigold mt-2">
              Start from your own memory
            </Link>
          </div>
        )}
      </section>

      {/* Closing CTA */}
      <section className="py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-3xl bg-coral px-8 py-14 text-center sm:px-16">
          <Sparkle className="absolute left-8 top-8 animate-twinkle text-marigold" size={24} />
          <Sparkle
            className="absolute bottom-8 right-10 animate-twinkle text-peach [animation-delay:0.8s]"
            size={20}
          />
          <h2 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">
            Every family has a story worth keeping.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-cream/90">
            It takes about five minutes to tell us yours. The book lasts a lifetime.
          </p>
          <Link
            href="/create"
            className="btn btn-marigold mt-8 text-lg"
          >
            Make your storybook
          </Link>
        </div>
      </section>
    </div>
  );
}
