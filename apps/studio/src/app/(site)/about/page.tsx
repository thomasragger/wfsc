import { getTranslations } from "next-intl/server";

import { Doodle } from "@/components/decor";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export async function generateMetadata() {
  const t = await getTranslations("legal.about");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * About page (English draft). Brand story, warm and plain-spoken.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-extrabold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default async function AboutPage() {
  const t = await getTranslations("legal.about");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="sun.png" size={48} className="animate-drift absolute left-[5%] top-0 hidden sm:block" />
        <Doodle src="cloud.png" size={44} className="animate-float absolute right-[7%] top-4 hidden sm:block" />
        <Doodle src="heart-small.png" size={24} className="animate-twinkle absolute left-[30%] top-8 hidden sm:block" />
        <Eyebrow className="mx-auto">{t("eyebrow")}</Eyebrow>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold text-ink sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-soft">
          {t("intro")}
        </p>
      </header>

      <div className="mt-12 space-y-10">
        <Section title={t("secWhyTitle")}>
          <p>{t("whyP1")}</p>
          <p>{t("whyP2")}</p>
        </Section>

        <Section title={t("secHowTitle")}>
          <p>{t("howP1")}</p>
          <p>
            {t("howP2")}{" "}
            <a href="/artists" className="font-semibold hover:text-coral">
              {t("artistsLink")}
            </a>{" "}
            {t("howP3")}
          </p>
        </Section>

        <Section title={t("secCareTitle")}>
          <p>
            {t("careP1")}{" "}
            <a href="/privacy" className="font-semibold hover:text-coral">
              {t("privacyLink")}
            </a>{" "}
            {t("careP2")}
          </p>
          <p>{t("careP3")}</p>
        </Section>

        <Section title={t("secHelloTitle")}>
          <p>
            {t("helloP1")}{" "}
            <a href="/contact" className="font-semibold hover:text-coral">
              {t("contactLink")}
            </a>{" "}
            {t("helloP2")}
          </p>
        </Section>
      </div>

      <section className="mt-14 rounded-3xl bg-lavender/60 p-8 text-center">
        <p className="font-display text-xl font-extrabold text-ink">
          {t("ctaTitle")}
        </p>
        <ButtonLink href="/create" size="lg" className="mt-5">
          {t("ctaButton")}
        </ButtonLink>
      </section>
    </div>
  );
}
