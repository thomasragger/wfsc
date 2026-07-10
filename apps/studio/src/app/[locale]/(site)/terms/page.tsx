import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Doodle } from "@/components/decor";
import { Eyebrow } from "@/components/ui/eyebrow";

export async function generateMetadata() {
  const t = await getTranslations("legal.terms");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * Terms of service (English draft). Facts that need the company entity (D1)
 * or a lawyer are marked with [LEGAL REVIEW].
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

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="sun.png" size={44} className="animate-drift absolute left-[5%] top-0 hidden sm:block" />
        <Doodle src="flower.png" size={26} className="animate-float absolute right-[7%] top-4 hidden sm:block" />
        <Eyebrow className="mx-auto">{t("eyebrow")}</Eyebrow>
        <h1 className="mx-auto mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">
          {t("intro")}
        </p>
      </header>

      <div className="mt-12 space-y-10">
        <Section title={t("secPartiesTitle")}>
          <p>
            {t("partiesP1")}{" "}
            <Review>{t("partiesReview")}</Review>{" "}
            {t("partiesP2")}{" "}
            <Link href="/imprint" className="font-semibold hover:text-coral">
              {t("impressum")}
            </Link>
            .
          </p>
        </Section>

        <Section title={t("secWhatTitle")}>
          <p>{t("whatP1")}</p>
        </Section>

        <Section title={t("secStudioTitle")}>
          <p>{t("studioP1")}</p>
        </Section>

        <Section title={t("secContentTitle")}>
          <p>
            {t("contentP1")}{" "}
            <Link href="/privacy" className="font-semibold hover:text-coral">
              {t("privacyLink")}
            </Link>{" "}
            {t("contentP2")}
          </p>
        </Section>

        <Section title={t("secPricesTitle")}>
          <p>{t("pricesP1")}</p>
        </Section>

        <Section title={t("secDeliveryTitle")}>
          <p>
            {t("deliveryP1")}{" "}
            <Review>{t("deliveryReview")}</Review>
          </p>
        </Section>

        <Section title={t("secWithdrawalTitle")}>
          <p>
            {t("withdrawalP1")}{" "}
            <Link href="/returns" className="font-semibold hover:text-coral">
              {t("returnsLink")}
            </Link>{" "}
            {t("withdrawalP2")}
          </p>
        </Section>

        <Section title={t("secWrongTitle")}>
          <p>
            {t("wrongP1")}{" "}
            <Review>{t("wrongReview")}</Review>
          </p>
        </Section>

        <Section title={t("secChangesTitle")}>
          <p>
            {t("changesP1")}{" "}
            <Review>{t("changesReview")}</Review>{" "}
            {t("changesP2")}
          </p>
        </Section>

        <Section title={t("secTalkTitle")}>
          <p>
            {t("talkP1")}{" "}
            <Link href="/contact" className="font-semibold hover:text-coral">
              {t("contactLink")}
            </Link>{" "}
            {t("talkP2")}
          </p>
        </Section>

        <p className="pt-2 text-center text-sm text-ink-soft">{t("lastUpdated")}</p>
      </div>
    </div>
  );
}
