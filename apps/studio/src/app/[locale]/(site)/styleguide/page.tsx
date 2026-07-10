/**
 * /styleguide — the WFSC design-system reference sheet.
 *
 * THIS PAGE IS THE LIVING CONTRACT: every visual component in the app has
 * exactly one canonical implementation in src/components/ui/* (plus the
 * decorative primitives in src/components/decor.tsx), and every surface —
 * landing, wizard, book hub, viewer, samples, editor — must consume ONLY
 * those. If you need a new piece of UI, add it to ui/*, catalogue it here,
 * and only then use it.
 */
import { notFound } from "next/navigation";
import Image from "next/image";

import { ArtPlaceholder, BlobFrame, Doodle, Sparkle } from "@/components/decor";
import { Alert, Toast } from "@/components/ui/alert";
import { CoverImage } from "@/components/ui/cover-image";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Polaroid } from "@/components/ui/card";
import { Carousel } from "@/components/ui/carousel";
import { Chip, PillLabel, Tag } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Field, Select, TextArea, TextInput } from "@/components/ui/input";
import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StepProgress } from "@/components/ui/steps";

export const metadata = {
  title: "Style guide",
  robots: { index: false },
};

/**
 * The style guide is an internal reference sheet. Keep it off the public site
 * in production unless SHOW_STYLEGUIDE is explicitly set (e.g. a preview build).
 */
function assertStyleguideVisible() {
  if (process.env.NODE_ENV === "production" && !process.env.SHOW_STYLEGUIDE) {
    notFound();
  }
}

const TOKENS = [
  { name: "ink", value: "#761e0b", text: "text-white" },
  { name: "coral (primary)", value: "#ff7916", text: "text-white" },
  { name: "ember", value: "#e8622c", text: "text-white" },
  { name: "marigold", value: "#f6b73c", text: "text-ink" },
  { name: "cobalt", value: "#2e5fd7", text: "text-white" },
  { name: "periwinkle", value: "#9db8f0", text: "text-ink" },
  { name: "rose", value: "#f9c5d1", text: "text-ink" },
  { name: "sage", value: "#7fa678", text: "text-white" },
  { name: "lavender", value: "#ece5f8", text: "text-ink" },
  { name: "peach", value: "#fbe3cb", text: "text-ink" },
  { name: "cream", value: "#fffaf7", text: "text-ink" },
];

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl font-extrabold text-ink">{title}</h2>
      {note ? <p className="mt-1 max-w-2xl text-sm text-ink-soft">{note}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function StyleguidePage() {
  assertStyleguideVisible();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-12">
        <Eyebrow>Design system</Eyebrow>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          The Warm Fuzzy component shelf.
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          One canonical implementation of everything, in <code className="rounded bg-lavender/70 px-1.5 py-0.5 text-xs font-bold text-cobalt">src/components/ui/*</code>.
          All new UI must come from these components — this page is the living contract.
        </p>
      </header>

      <div className="flex flex-col gap-14">
        {/* ------------------------------------------------------------ tokens */}
        <Section id="tokens" title="Color tokens" note="Brand palette lifted from the live Shopify theme; defined in globals.css @theme.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {TOKENS.map((token) => (
              <div
                key={token.name}
                className={`flex aspect-[5/3] flex-col justify-end rounded-2xl p-3 ring-1 ring-ink/10 ${token.text}`}
                style={{ background: token.value }}
              >
                <p className="font-display text-sm font-bold">{token.name}</p>
                <p className="text-xs opacity-80">{token.value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* -------------------------------------------------------- typography */}
        <Section
          id="type"
          title="Type scale"
          note="Baloo 2 for display (font-display), Quicksand for body. Eyebrow → display heading → soft body."
        >
          <Card className="flex flex-col gap-5 p-8">
            <Eyebrow>Eyebrow kicker</Eyebrow>
            <p className="font-display text-5xl font-extrabold text-ink">Display / 5xl extrabold</p>
            <p className="font-display text-3xl font-extrabold text-ink">Heading / 3xl extrabold</p>
            <p className="font-display text-2xl font-bold text-ink">Heading / 2xl bold</p>
            <p className="font-display text-lg font-bold text-ink">Subheading / lg bold</p>
            <p className="max-w-xl text-base text-ink">
              Body / base — Quicksand carries the storytelling voice: warm, round, easy to read
              at bedtime.
            </p>
            <p className="max-w-xl text-sm text-ink-soft">
              Body soft / sm — supporting copy uses <code>text-ink-soft</code> (#a15b44).
            </p>
            <p className="text-xs font-semibold text-ink-soft">Caption / xs semibold</p>
          </Card>
        </Section>

        {/* ---------------------------------------------------------- buttons */}
        <Section
          id="buttons"
          title="Buttons"
          note="Button / ButtonLink from ui/button. Variants: primary (coral), secondary (marigold), ghost. Sizes sm / md / lg, plus disabled and pending states."
        >
          <Card className="flex flex-col gap-6 p-8">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <ButtonLink href="/styleguide" variant="ghost">
                ButtonLink
              </ButtonLink>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled>Disabled</Button>
              <Button pending pendingLabel="Creating your preview…">
                Create my free preview
              </Button>
              <Button variant="secondary" pending pendingLabel="Uploading photos…">
                Continue
              </Button>
            </div>
          </Card>
        </Section>

        {/* ----------------------------------------------------------- inputs */}
        <Section
          id="inputs"
          title="Inputs"
          note="Field + TextInput / TextArea / Select from ui/input. Pill radius, lavender border, marigold focus ring."
        >
          <Card className="grid gap-5 p-8 sm:grid-cols-2">
            <Field label="Text input" htmlFor="sg-text" hint="Helper text lives down here.">
              <TextInput id="sg-text" placeholder="Mia" />
            </Field>
            <Field label="Pill input" htmlFor="sg-pill" optional>
              <TextInput id="sg-pill" pill placeholder="you@example.com" />
            </Field>
            <Field label="Textarea" htmlFor="sg-area">
              <TextArea id="sg-area" className="min-h-24" placeholder="Tell us your story…" />
            </Field>
            <Field label="Select" htmlFor="sg-select">
              <Select id="sg-select" defaultValue="mama">
                <option value="child">Child</option>
                <option value="mama">Mama</option>
                <option value="papa">Papa</option>
              </Select>
            </Field>
          </Card>
        </Section>

        {/* ------------------------------------------------------ chips & pills */}
        <Section
          id="chips"
          title="Chips & pills"
          note="Chip (selectable option), PillLabel (white label pill), Tag (tiny tinted label), Eyebrow."
        >
          <Card className="flex flex-col gap-5 p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Chip selected>0–2 years</Chip>
              <Chip>3–5 years</Chip>
              <Chip>6–8 years</Chip>
              <Chip disabled>Disabled</Chip>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PillLabel>Grandparents</PillLabel>
              <Tag>Siblings</Tag>
              <Eyebrow>Need a spark?</Eyebrow>
            </div>
          </Card>
        </Section>

        {/* ------------------------------------------------------------ cards */}
        <Section
          id="cards"
          title="Cards"
          note="Card (frosted panel), Polaroid (photo + caption), and the gradient category tile with a scalloped photo mask."
        >
          <div className="grid gap-6 sm:grid-cols-3">
            <Card className="p-6">
              <p className="font-display font-bold text-ink">Plain card</p>
              <p className="mt-1 text-sm text-ink-soft">
                Frosted white, soft fuzzy shadow, 1px white ring.
              </p>
            </Card>
            <Polaroid
              tilt="-2deg"
              media={
                <Image
                  src="/categories/book-1.jpg"
                  alt=""
                  width={280}
                  height={335}
                  className="h-auto w-full"
                />
              }
              caption="Sabine & Aunt Mary"
              className="mx-auto w-44"
            />
            <div
              className="relative mx-auto aspect-[4/5] w-44 overflow-hidden rounded-3xl shadow-fuzzy"
              style={{ background: "linear-gradient(160deg, #F6B73C, #F0913A)" }}
            >
              <div className="scallop absolute inset-[7%] overflow-hidden">
                <Image
                  src="/categories/kids.jpg"
                  alt=""
                  width={480}
                  height={600}
                  className="h-full w-full object-cover"
                />
              </div>
              <PillLabel className="absolute bottom-4 left-4">Kids</PillLabel>
            </div>
          </div>
        </Section>

        {/* -------------------------------------------------------- cover tile */}
        <Section
          id="book"
          title="Cover image"
          note="CoverImage from ui/cover-image — a plain, square, rounded book cover using the shared tile-lift hover. (The earlier 3D BookMockup is parked; its hover read as glitchy and it's simpler to keep every tile consistent.)"
        >
          <Card className="flex flex-wrap items-end justify-center gap-10 p-10">
            <CoverImage src="/categories/babies.jpg" alt="Luca's First Splash" size="sm" />
            <CoverImage src="/categories/kids.jpg" alt="The Night We Camped in the Garden" size="md" />
            <CoverImage src={null} alt="Cover on its way" size="sm" />
          </Card>
        </Section>

        {/* -------------------------------------------------- scallop & doodles */}
        <Section
          id="decor"
          title="Scallop mask, blob frames & doodles"
          note="The scalloped squircle mask (.scallop), the how-it-works BlobFrame, brand doodles, ArtPlaceholder and Sparkle from components/decor."
        >
          <Card className="flex flex-wrap items-center gap-8 p-8">
            <div className="scallop h-28 w-28 overflow-hidden">
              <Image
                src="/categories/mums.jpg"
                alt=""
                width={160}
                height={160}
                className="h-full w-full object-cover"
              />
            </div>
            <BlobFrame shape="shell" from="#ff7916" to="#f6b73c" className="w-28">
              <Image src="/mascot/part2.png" alt="" width={90} height={90} className="h-auto w-full" />
            </BlobFrame>
            <div className="flex items-center gap-4">
              <Doodle src="sun.png" size={44} className="animate-drift" />
              <Doodle src="cloud.png" size={44} className="animate-float" />
              <Doodle src="heart.png" size={30} className="animate-twinkle" />
              <Doodle src="flower.png" size={34} />
              <Sparkle className="text-marigold" size={26} />
            </div>
            <div className="h-28 w-28 overflow-hidden rounded-2xl">
              <ArtPlaceholder label="ArtPlaceholder" />
            </div>
          </Card>
        </Section>

        {/* ---------------------------------------------------------- loaders */}
        <Section
          id="loaders"
          title="Loaders"
          note="Spinner (pending actions) and Skeleton / SkeletonGrid (async surfaces). Every async surface gets a skeleton, every pending button a spinner."
        >
          <Card className="flex flex-col gap-6 p-8">
            <div className="flex items-center gap-6 text-coral">
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" />
              <span className="text-ink">
                <Spinner size="md" />
              </span>
            </div>
            <SkeletonGrid count={3} className="grid gap-4 sm:grid-cols-3" itemClassName="h-28" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16" rounded="rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" rounded="rounded-full" />
                <Skeleton className="h-4 w-1/2" rounded="rounded-full" />
              </div>
            </div>
          </Card>
        </Section>

        {/* ------------------------------------------------------------ steps */}
        <Section id="steps" title="Step progress" note="StepProgress from ui/steps — the wizard rail.">
          <Card className="p-8">
            <StepProgress steps={["Your story", "Who's in it", "Pick a style", "Your email"]} current={2} />
          </Card>
        </Section>

        {/* --------------------------------------------------------- carousel */}
        <Section
          id="carousel"
          title="Carousel"
          note="Carousel from ui/carousel — pointer-draggable, arrow buttons, no visible scrollbar. Used for categories and inspiration galleries."
        >
          <Carousel ariaLabel="Carousel demo">
            {TOKENS.slice(0, 8).map((token) => (
              <div
                key={token.name}
                className={`flex aspect-[4/5] w-40 shrink-0 snap-start items-end rounded-3xl p-4 shadow-fuzzy ${token.text}`}
                style={{ background: token.value }}
              >
                <span className="font-display text-sm font-bold">{token.name}</span>
              </div>
            ))}
          </Carousel>
        </Section>

        {/* --------------------------------------------------- toasts & alerts */}
        <Section
          id="feedback"
          title="Alerts & toasts"
          note="Alert (inline, tones error / info / success) and Toast (floating, mounted conditionally — shown here inline for reference)."
        >
          <Card className="flex flex-col gap-4 p-8">
            <Alert>Something went wrong — please try again.</Alert>
            <Alert tone="info">
              We only use your email for your preview link and order updates.
            </Alert>
            <Alert tone="success">Your dedication was saved.</Alert>
            <div className="rounded-2xl bg-cream py-4 ring-1 ring-ink/5">
              <Toast inline>Saved — every page kept safe.</Toast>
            </div>
          </Card>
        </Section>

        {/* ------------------------------------------------------ empty states */}
        <Section
          id="empty"
          title="Empty states"
          note="EmptyState from ui/empty-state — an invitation to act, never a dead end."
        >
          <EmptyState
            title="The first sample books are still at the printer's."
            body="Check back very soon — or skip the queue and make a book starring your own family."
            action={<Button>Write your story</Button>}
          />
        </Section>
      </div>
    </div>
  );
}
