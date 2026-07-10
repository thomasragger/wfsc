import { Eyebrow } from "@/components/ui/eyebrow";
import { ButtonLink } from "@/components/ui/button";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Our styles — Warm Fuzzy Story Club",
  description:
    "Explore the illustration styles your storybook can be drawn in, from soft watercolor to bold cut-paper. Every look is crafted, never a generic filter.",
};

/** Customer-facing blurb per style (the DB style_prompt is model-only). */
const STYLE_COPY: Record<string, string> = {
  "flat-vector": "Bold, sunny cut-paper shapes with clean edges and a warm, graphic palette.",
  watercolor: "Soft, dreamy washes and gentle edges, like a hand-painted keepsake.",
  "riso-print": "Retro screen-print energy: grainy texture, bright inks, playful misregistration.",
  crayon: "Joyful, childlike crayon strokes, as if drawn at the kitchen table.",
  "mid-century": "Nostalgic mid-century storybook charm, characterful lines and muted warmth.",
  "retro-cartoon": "Timeless Saturday-morning cartoon shapes, bold outlines and bounce.",
  "textured-flat": "Textured flat-colour printmaking with folk-art warmth.",
};

interface StyleRow {
  id: string;
  name: string;
  reference_image_urls: string[] | null;
}

export default async function StylesPage() {
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
        <Eyebrow className="mx-auto">Real craft, not a filter</Eyebrow>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          The styles your story can wear
        </h1>
        <p className="mx-auto mt-4 text-ink-soft">
          Every book is illustrated in one of these signature looks, cover to cover. Each style has
          its own colour, texture and mood, so you can match the feeling of your memory. Pick one in
          the first step of the wizard, and change your mind anytime.
        </p>
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
                        alt={`${style.name} sample art`}
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
                  {STYLE_COPY[style.id] ?? "A signature Warm Fuzzy Story Club look."}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-16 rounded-3xl bg-marigold/15 p-8 text-center">
        <p className="font-display text-xl font-extrabold text-ink">Are you an illustrator?</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          We&apos;re always looking to grow the family of styles, and we pay artists for their craft.
          If you&apos;d love to see your work become storybooks, tell us about it.
        </p>
        <ButtonLink href="mailto:hello@warmfuzzystoryclub.com?subject=Artist%20collaboration" size="lg" className="mt-5">
          Get in touch
        </ButtonLink>
      </section>

      <div className="mt-12 text-center">
        <ButtonLink href="/create" size="lg">
          Start your story
        </ButtonLink>
      </div>
    </div>
  );
}
