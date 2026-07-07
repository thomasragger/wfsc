import Image from "next/image";
import Link from "next/link";

import {
  ArtPlaceholder,
  BlobFrame,
  Doodle,
  DoodleField,
  DoodleSprinkle,
  Sparkle,
} from "@/components/decor";
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

/** Best-guess brand photo for a category header, keyed loosely by name. */
function categoryPhoto(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("mum") || n.includes("mom")) return "mums";
  if (n.includes("dad")) return "dads";
  if (n.includes("grand")) return "grandparents";
  if (n.includes("sib")) return "siblings";
  if (n.includes("bab") || n.includes("first")) return "babies";
  return "kids";
}

const STEPS = [
  {
    label: "Tell us your story",
    body: "A trip to the sea, pancake Sundays, the day the training wheels came off. Write it the way you'd tell it at bedtime.",
    art: "/mascot/part1.png",
    shape: "cloud" as const,
    from: "#f6b73c",
    to: "#e8622c",
    labelClass: "text-coral",
  },
  {
    label: "Upload your pictures",
    body: "A few photos of the people in your story. Our illustrators turn them into storybook characters that are unmistakably them.",
    art: "/mascot/part2.png",
    shape: "shell" as const,
    from: "#f6b73c",
    to: "#f0913a",
    labelClass: "text-marigold-deep",
  },
  {
    label: "Experience the magic",
    body: "Watch your memory become a fully illustrated picture book, then hold the printed copy in your hands.",
    art: "/mascot/part3.png",
    shape: "coil" as const,
    from: "#2e5fd7",
    to: "#9d8ce8",
    labelClass: "text-cobalt",
  },
];

const MEMORY_CARDS = [
  { photo: "grandparents", caption: "Ella & Grandpa", tilt: "-7deg", className: "z-10 w-40 sm:w-52" },
  { photo: "mums", caption: "Malia & Mama", tilt: "5deg", className: "z-20 w-44 sm:w-56", float: true },
  { photo: "siblings", caption: "Theo & Sam", tilt: "-3deg", className: "z-10 w-36 sm:w-48" },
];

export default async function HomePage() {
  const inspiration = await loadInspiration();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr]">
        <DoodleField />
        <div className="relative z-10 flex flex-col items-start gap-6">
          <span className="eyebrow">
            <Sparkle size={13} className="text-marigold" />
            A storybook starring your family
          </span>
          <h1 className="font-display text-[2.7rem] font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl">
            Turning memories into <span className="text-coral">art</span> for a lifetime.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft">
            Tell us about a day you never want to forget. We turn it into a beautifully
            illustrated, printed children&rsquo;s book &mdash; with your family as the heroes.
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

        {/* Floating memory cards */}
        <div className="relative z-10 mx-auto flex min-h-[22rem] max-w-md items-center justify-center gap-0 py-4">
          {MEMORY_CARDS.map((card, i) => (
            <figure
              key={card.photo}
              className={`group relative -mx-3 shrink-0 rounded-2xl bg-white p-2 shadow-polaroid ring-1 ring-black/5 ${card.className} ${
                card.float ? "animate-float" : "animate-drift"
              }`}
              style={
                {
                  "--tilt": card.tilt,
                  transform: `rotate(${card.tilt}) translateY(${i === 1 ? "-1.5rem" : i === 2 ? "1rem" : "0"})`,
                  animationDelay: `${i * 0.5}s`,
                } as React.CSSProperties
              }
            >
              <div className="overflow-hidden rounded-xl">
                <Image
                  src={`/categories/${card.photo}.jpg`}
                  alt={card.caption}
                  width={280}
                  height={336}
                  priority={i === 1}
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="px-1 pb-1 pt-2 text-center font-display text-sm font-bold text-ink">
                {card.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- How it works */}
      <section className="relative py-14 sm:py-20">
        <DoodleSprinkle />
        <div className="relative z-10 text-center">
          <span className="eyebrow mx-auto">How it works</span>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-[2.6rem]">
            From a memory at the kitchen table to a hardcover on the shelf.
          </h2>
        </div>

        <ol className="relative z-10 mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex flex-col items-center text-center">
              <BlobFrame
                shape={step.shape}
                from={step.from}
                to={step.to}
                className="w-52 sm:w-full sm:max-w-[15rem]"
              >
                <Image
                  src={step.art}
                  alt=""
                  width={260}
                  height={260}
                  loading="lazy"
                  className="h-auto w-full drop-shadow-sm"
                />
              </BlobFrame>
              <p className={`mt-5 font-display text-xl font-extrabold ${step.labelClass}`}>
                <span className="mr-1.5 text-ink/25">{i + 1}</span>
                {step.label}
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------- Inspiration gallery */}
      <section id="ideas" className="scroll-mt-24 py-12 sm:py-16">
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

        {inspiration ? (
          <div className="mt-10 flex flex-col gap-14">
            {inspiration.categories.map((cat) => {
              const templates = inspiration.templates.filter((t) => t.category_id === cat.id);
              if (templates.length === 0) return null;
              const photo = categoryPhoto(cat.name);
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-4">
                    <div className="scallop h-14 w-14 shrink-0 overflow-hidden sm:h-16 sm:w-16">
                      <Image
                        src={`/categories/${photo}.jpg`}
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

      {/* ------------------------------------------------------- Closing CTA */}
      <section className="py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-coral via-coral to-coral-deep px-8 py-16 text-center shadow-pop sm:px-16">
          <Doodle src="sun.png" size={64} className="animate-drift absolute left-6 top-8 opacity-90" />
          <Doodle src="cloud.png" size={56} className="animate-float absolute right-8 top-10 opacity-90 [animation-delay:0.7s]" />
          <Doodle src="flower.png" size={34} className="animate-drift absolute bottom-10 left-[16%] [animation-delay:1.2s]" />
          <Doodle src="heart-small.png" size={30} className="animate-twinkle absolute bottom-12 right-[18%]" />
          <div className="relative z-10">
            <h2 className="mx-auto max-w-xl font-display text-3xl font-extrabold text-cream sm:text-[2.6rem]">
              Every family has a story worth keeping.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-cream/90">
              It takes about five minutes to tell us yours. The book lasts a lifetime.
            </p>
            <Link href="/create" className="btn btn-marigold mt-8 text-lg">
              Make your storybook
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
