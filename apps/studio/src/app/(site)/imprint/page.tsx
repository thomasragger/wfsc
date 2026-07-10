import { Doodle } from "@/components/decor";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata = {
  title: "Impressum · Warm Fuzzy Story Club",
  description: "Anbieterkennzeichnung nach § 5 DDG für Warm Fuzzy Story Club.",
};

/**
 * Impressum (German provider identification, legally required for DACH).
 * Kept in German by law. Every real legal fact from decision D1 is not yet
 * available, so it is marked with a visible [LEGAL REVIEW] placeholder.
 */
function Review({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-marigold/40 px-1.5 py-0.5 font-bold text-ink">
      [LEGAL REVIEW] {children}
    </mark>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/70 p-6 shadow-fuzzy ring-1 ring-ink/5 sm:p-8">
      <h2 className="font-display text-xl font-extrabold text-ink">{title}</h2>
      <div className="mt-3 space-y-2 leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default function ImprintPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="sun.png" size={44} className="animate-drift absolute left-[4%] top-0 hidden sm:block" />
        <Doodle src="cloud.png" size={40} className="animate-float absolute right-[6%] top-4 hidden sm:block" />
        <Eyebrow className="mx-auto">Rechtliches</Eyebrow>
        <h1 className="mx-auto mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          Impressum
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-ink-soft">
          Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).
        </p>
      </header>

      <div className="mt-12 space-y-6">
        <Block title="Anbieter">
          <p>
            <Review>Vollständiger Firmenname des Unternehmens (Rechtsform, z. B. GmbH).</Review>
          </p>
          <p>
            <Review>Straße und Hausnummer.</Review>
          </p>
          <p>
            <Review>Postleitzahl, Ort und Land.</Review>
          </p>
        </Block>

        <Block title="Vertreten durch">
          <p>
            <Review>Name der vertretungsberechtigten Person(en), z. B. Geschäftsführer/in.</Review>
          </p>
        </Block>

        <Block title="Kontakt">
          <p>
            Telefon: <Review>Telefonnummer.</Review>
          </p>
          <p>
            E-Mail:{" "}
            <a href="mailto:hello@warmfuzzystoryclub.com" className="font-semibold hover:text-coral">
              hello@warmfuzzystoryclub.com
            </a>
          </p>
          <p>
            Website:{" "}
            <a href="https://warmfuzzystoryclub.com" className="font-semibold hover:text-coral">
              warmfuzzystoryclub.com
            </a>
          </p>
        </Block>

        <Block title="Registereintrag">
          <p>
            Eintragung im Handelsregister. Registergericht: <Review>zuständiges Registergericht.</Review>
          </p>
          <p>
            Registernummer: <Review>Handelsregisternummer (z. B. HRB 12345).</Review>
          </p>
        </Block>

        <Block title="Umsatzsteuer-Identifikationsnummer">
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:{" "}
            <Review>USt-IdNr.</Review>
          </p>
        </Block>

        <Block title="Redaktionell verantwortlich">
          <p>Verantwortlich für den Inhalt nach § 18 Abs. 2 Medienstaatsvertrag (MStV):</p>
          <p>
            <Review>Name und Anschrift der verantwortlichen Person.</Review>
          </p>
        </Block>

        <Block title="Streitbeilegung">
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              className="font-semibold hover:text-coral"
              rel="noopener noreferrer"
              target="_blank"
            >
              https://ec.europa.eu/consumers/odr
            </a>
            . Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </p>
          <p>
            Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Block>

        <p className="pt-2 text-center text-sm text-ink-soft">Stand: Juli 2026.</p>
      </div>
    </div>
  );
}
