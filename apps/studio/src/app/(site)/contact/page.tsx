import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Doodle } from "@/components/decor";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export async function generateMetadata() {
  const t = await getTranslations("legal.contact");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * Contact page (English draft). Real, structured contact detail rather than a
 * lone mailto link: purpose-specific addresses, response times, and what to
 * include. Facts needing D1 (postal address) are marked with [LEGAL REVIEW].
 */
// One mascot coin per contact channel (in card order), matching the tinted
// mascot treatment on the home page.
const CHANNEL_ART = [
  { mascot: "/mascots/story.png", tint: "#efe9ff" },
  { mascot: "/mascots/family.png", tint: "#fce9ef" },
  { mascot: "/mascots/travel.png", tint: "#e6f3fb" },
];

function Review({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-marigold/40 px-1.5 py-0.5 font-bold text-ink">
      [LEGAL REVIEW] {children}
    </mark>
  );
}

export default async function ContactPage() {
  const t = await getTranslations("legal.contact");

  const channels = t.raw("channels") as {
    emoji: string;
    title: string;
    body: string;
    email: string;
    subject: string;
  }[];
  const helpItems = t.raw("helpItems") as string[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="sun.png" size={44} className="animate-drift absolute left-[5%] top-0 hidden sm:block" />
        <Doodle src="heart-small.png" size={26} className="animate-twinkle absolute right-[8%] top-4 hidden sm:block" />
        <Eyebrow className="mx-auto">{t("eyebrow")}</Eyebrow>
        <h1 className="mx-auto mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">
          {t("intro")}
        </p>
      </header>

      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {channels.map((c, i) => {
          const art = CHANNEL_ART[i % CHANNEL_ART.length];
          return (
          <div
            key={c.title}
            className="flex flex-col rounded-3xl bg-white/70 p-6 shadow-fuzzy ring-1 ring-ink/5"
          >
            <div
              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ring-4 ring-white shadow-polaroid"
              style={{ backgroundColor: art.tint }}
            >
              <Image
                src={art.mascot}
                alt=""
                width={128}
                height={128}
                className="h-full w-full object-cover"
              />
            </div>
            <h2 className="mt-4 font-display text-lg font-extrabold text-ink">{c.title}</h2>
            <p className="mt-2 flex-1 text-sm text-ink-soft">{c.body}</p>
            <a
              href={`mailto:${c.email}?subject=${encodeURIComponent(c.subject)}`}
              className="mt-4 break-words text-sm font-bold text-coral hover:text-coral-deep"
            >
              {c.email}
            </a>
          </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-3xl bg-marigold/15 p-6 sm:p-8">
        <h2 className="font-display text-xl font-extrabold text-ink">
          {t("helpTitle")}
        </h2>
        <p className="mt-2 text-ink-soft">
          {t("helpIntro")}
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-soft">
          {helpItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-ink-soft">
          {t("helpResponse")} <Review>{t("helpResponseReview")}</Review>
        </p>
      </section>

      <section className="mt-8 rounded-3xl bg-white/70 p-6 shadow-fuzzy ring-1 ring-ink/5 sm:p-8">
        <h2 className="font-display text-xl font-extrabold text-ink">{t("postTitle")}</h2>
        <p className="mt-2 text-ink-soft">
          {t("postP1")} <Review>{t("postReview")}</Review> {t("postP2")}{" "}
          <a href="/imprint" className="font-semibold hover:text-coral">
            {t("impressum")}
          </a>
          .
        </p>
      </section>

      <div className="mt-12 text-center">
        <p className="font-display text-lg font-bold text-ink">{t("ctaTitle")}</p>
        <ButtonLink href="/create" className="mt-4">
          {t("ctaButton")}
        </ButtonLink>
      </div>
    </div>
  );
}
