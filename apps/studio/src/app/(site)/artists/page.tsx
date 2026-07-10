import { Eyebrow } from "@/components/ui/eyebrow";
import { ButtonLink } from "@/components/ui/button";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Our artists — Warm Fuzzy Story Club",
  description:
    "Every WFSC art style is a real illustrator's world. Meet the styles, and the artists behind them.",
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

export default async function ArtistsPage() {
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
        <Eyebrow className="mx-auto">Real hands, real craft</Eyebrow>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          The artists behind the styles
        </h1>
        <p className="mx-auto mt-4 text-ink-soft">
          Every look on Warm Fuzzy Story Club begins with a real illustrator&apos;s world, not a
          generic filter. We&apos;re partnering with working artists to bring their signature craft
          to your family&apos;s story. Their names and studios are coming soon.
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
                {/* Placeholder artist slot — filled once a partnership is live. */}
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-lavender/50 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-base shadow-sm">
                    🎨
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink">Artist reveal coming soon</p>
                    <p className="text-[0.7rem] text-ink-soft">
                      In collaboration with a working illustrator.
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-16 rounded-3xl bg-marigold/15 p-8 text-center">
        <p className="font-display text-xl font-extrabold text-ink">Are you an illustrator?</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          We&apos;d love to feature your style and pay you for every book made in it. Tell us about
          your work.
        </p>
        <ButtonLink href="mailto:hello@warmfuzzystoryclub.com?subject=Artist%20collaboration" size="lg" className="mt-5">
          Get in touch
        </ButtonLink>
      </section>
    </div>
  );
}
