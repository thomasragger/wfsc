import { getTranslations } from "next-intl/server";

import { Doodle } from "@/components/decor";
import { Eyebrow } from "@/components/ui/eyebrow";

export async function generateMetadata() {
  const t = await getTranslations("legal.privacy");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * Privacy policy (English draft). Reflects the real sub-processors from
 * docs/data-processing.md and the D3 retention window. Facts that need a
 * lawyer or the company entity (D1) are marked with [LEGAL REVIEW].
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

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");

  const shortItems = t.raw("shortItems") as string[];
  const collectItems = t.raw("collectItems") as { label: string; text: string }[];
  const retainItems = t.raw("retainItems") as { label: string; text: string }[];
  const tableHeaders = t.raw("tableHeaders") as {
    partner: string;
    share: string;
    why: string;
    where: string;
  };
  const processors = t.raw("processors") as {
    name: string;
    data: string;
    purpose: string;
    where: string;
  }[];

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
        <p className="font-display text-lg font-extrabold">{t("shortTitle")}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
          {shortItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-12 space-y-10">
        <Section title={t("secWhoTitle")}>
          <p>
            {t("whoP1")}{" "}
            <Review>{t("whoReview1")}</Review>{" "}
            {t("whoP2")}{" "}
            <a href="mailto:privacy@warmfuzzystoryclub.com" className="font-semibold hover:text-coral">
              privacy@warmfuzzystoryclub.com
            </a>{" "}
            {t("whoP3")}{" "}
            <Review>{t("whoReview2")}</Review>{" "}
            {t("whoP4")}{" "}
            <a href="/imprint" className="font-semibold hover:text-coral">
              {t("impressum")}
            </a>
            .
          </p>
        </Section>

        <Section title={t("secCollectTitle")}>
          <p>{t("collectIntro")}</p>
          <ul className="list-disc space-y-2 pl-5">
            {collectItems.map((item, i) => (
              <li key={i}>
                <span className="font-semibold text-ink">{item.label}</span> {item.text}
              </li>
            ))}
          </ul>
          <p>{t("collectTech")}</p>
        </Section>

        <Section title={t("secLegalTitle")}>
          <p>
            {t("legalBasis")}{" "}
            <Review>{t("legalReview")}</Review>
          </p>
        </Section>

        <Section title={t("secAiTitle")}>
          <p>{t("aiIntro")}</p>
          <div className="mt-2 overflow-x-auto rounded-3xl bg-white/70 shadow-fuzzy ring-1 ring-ink/5">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-ink">
                  <th className="p-4 font-display font-extrabold">{tableHeaders.partner}</th>
                  <th className="p-4 font-display font-extrabold">{tableHeaders.share}</th>
                  <th className="p-4 font-display font-extrabold">{tableHeaders.why}</th>
                  <th className="p-4 font-display font-extrabold">{tableHeaders.where}</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {processors.map((p) => (
                  <tr key={p.name} className="border-b border-ink/5 last:border-0 align-top">
                    <td className="p-4 font-semibold text-ink">{p.name}</td>
                    <td className="p-4">{p.data}</td>
                    <td className="p-4">{p.purpose}</td>
                    <td className="p-4">{p.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{t("aiInngest")}</p>
          <p>
            {t("aiTransfers")}{" "}
            <Review>{t("aiTransfersReview")}</Review>
          </p>
        </Section>

        <Section title={t("secRetainTitle")}>
          <p>{t("retainIntro")}</p>
          <ul className="list-disc space-y-2 pl-5">
            {retainItems.map((item, i) => (
              <li key={i}>
                <span className="font-semibold text-ink">{item.label}</span> {item.text}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("secProtectTitle")}>
          <p>{t("protect")}</p>
        </Section>

        <Section title={t("secCookiesTitle")}>
          <p>
            {t("cookies")}{" "}
            <Review>{t("cookiesReview")}</Review>
          </p>
        </Section>

        <Section title={t("secRightsTitle")}>
          <p>
            {t("rights1")}{" "}
            <a href="mailto:privacy@warmfuzzystoryclub.com" className="font-semibold hover:text-coral">
              privacy@warmfuzzystoryclub.com
            </a>{" "}
            {t("rights2")}{" "}
            <Review>{t("rightsReview")}</Review>
          </p>
        </Section>

        <Section title={t("secChangesTitle")}>
          <p>{t("changes")}</p>
        </Section>

        <p className="pt-2 text-center text-sm text-ink-soft">{t("lastUpdated")}</p>
      </div>
    </div>
  );
}
