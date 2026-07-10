import { getTranslations } from "next-intl/server";

import { Doodle } from "@/components/decor";
import { Eyebrow } from "@/components/ui/eyebrow";

export async function generateMetadata() {
  const t = await getTranslations("legal.returns");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * Returns / right-of-withdrawal (English draft). Covers the 14-day EU
 * withdrawal right AND the custom-made-goods exception per Art. 246a EGBGB /
 * Section 312g Abs. 2 Nr. 1 BGB. Facts needing D1 / a lawyer are marked
 * with [LEGAL REVIEW].
 */
function Review({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-marigold/40 px-1.5 py-0.5 font-bold text-ink">
      [LEGAL REVIEW] {children}
    </mark>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-extrabold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default async function ReturnsPage() {
  const t = await getTranslations("legal.returns");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="heart.png" size={40} className="animate-drift absolute left-[5%] top-0 hidden sm:block" />
        <Doodle src="cloud.png" size={40} className="animate-float absolute right-[6%] top-4 hidden sm:block" />
        <Eyebrow className="mx-auto">{t("eyebrow")}</Eyebrow>
        <h1 className="mx-auto mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">
          {t("intro")}
        </p>
      </header>

      <div className="mt-10 rounded-3xl bg-lavender/60 p-6 leading-relaxed text-ink sm:p-8">
        <p className="font-display text-lg font-extrabold">{t("breathTitle")}</p>
        <p className="mt-2 text-ink-soft">
          {t("breathBody")}
        </p>
      </div>

      <div className="mt-12 space-y-10">
        <Section title={t("secRightTitle")}>
          <p>{t("rightP1")}</p>
        </Section>

        <Section title={t("secExceptionTitle")}>
          <p>{t("exceptionP1")}</p>
          <p>
            {t("exceptionP2")}{" "}
            <Review>{t("exceptionReview")}</Review>
          </p>
        </Section>

        <Section title={t("secCancelTitle")}>
          <p>
            {t("cancelP1")}{" "}
            <a href="/contact" className="font-semibold hover:text-coral">
              {t("contactLink")}
            </a>{" "}
            {t("cancelP2")}
          </p>
        </Section>

        <Section title={t("secFaultyTitle")}>
          <p>{t("faultyP1")}</p>
        </Section>

        <Section title={t("secReachTitle")}>
          <p>
            {t("reachP1")}{" "}
            <a href="mailto:hello@warmfuzzystoryclub.com" className="font-semibold hover:text-coral">
              hello@warmfuzzystoryclub.com
            </a>{" "}
            {t("reachP2")}{" "}
            <a href="/contact" className="font-semibold hover:text-coral">
              {t("contactLink")}
            </a>{" "}
            {t("reachP3")}{" "}
            <Review>{t("reachReview")}</Review>
          </p>
        </Section>

        <p className="pt-2 text-center text-sm text-ink-soft">{t("lastUpdated")}</p>
      </div>
    </div>
  );
}
