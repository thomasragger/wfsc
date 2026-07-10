import { Doodle } from "@/components/decor";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata = {
  title: "Privacy · Warm Fuzzy Story Club",
  description:
    "How Warm Fuzzy Story Club handles your photos, your family memories, and your personal data. Plainly, and with care.",
};

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

const PROCESSORS: { name: string; data: string; purpose: string; where: string }[] = [
  {
    name: "Supabase",
    data: "Everything you enter: photos, names, memory text, dedication, email, book files",
    purpose: "Our database and file storage",
    where: "EU / EEA hosting",
  },
  {
    name: "Vercel",
    data: "Request data, IP address, coarse location from network headers",
    purpose: "Hosting and serving the website",
    where: "United States",
  },
  {
    name: "Anthropic (Claude)",
    data: "Your memory text, character names, and character reference images",
    purpose: "AI that writes the story and describes how each character looks",
    where: "United States",
  },
  {
    name: "Replicate",
    data: "Your photos (via short-lived private links), character sheets, and style references",
    purpose: "AI that turns photos into illustrated characters and artwork",
    where: "United States",
  },
  {
    name: "Shopify",
    data: "Email, shipping address, and order details",
    purpose: "Checkout, payment, and order records",
    where: "United States / global",
  },
  {
    name: "Lulu",
    data: "Name, shipping address, phone, email, and the print-ready book file",
    purpose: "Printing and shipping your physical book",
    where: "United States / EU print network",
  },
  {
    name: "Resend",
    data: "Your email address and the book title",
    purpose: "Sending your preview, review, and order emails",
    where: "United States",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="heart.png" size={40} className="animate-drift absolute left-[5%] top-0 hidden sm:block" />
        <Doodle src="cloud.png" size={40} className="animate-float absolute right-[6%] top-4 hidden sm:block" />
        <Eyebrow className="mx-auto">Your trust matters</Eyebrow>
        <h1 className="mx-auto mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          Privacy
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">
          You are handing us photos of the people you love most, often your children. We treat that
          like the gift it is. Here is exactly what happens to your data, in plain words.
        </p>
      </header>

      <div className="mt-10 rounded-3xl bg-lavender/60 p-6 leading-relaxed text-ink sm:p-8">
        <p className="font-display text-lg font-extrabold">The short version</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
          <li>We use your photos and words only to make your book. Nothing else.</li>
          <li>We never sell your data and never send you marketing you did not ask for.</li>
          <li>
            To create the book, your content is processed by trusted AI and print partners, listed
            below.
          </li>
          <li>
            Source photos are deleted 30 days after your book is delivered. Your memory text is kept
            only while your book exists.
          </li>
          <li>You can ask us to delete everything at any time.</li>
        </ul>
      </div>

      <div className="mt-12 space-y-10">
        <Section title="Who is responsible for your data">
          <p>
            The controller for your personal data is <Review>the WFSC legal entity name.</Review>{" "}
            You can reach us at{" "}
            <a href="mailto:privacy@warmfuzzystoryclub.com" className="font-semibold hover:text-coral">
              privacy@warmfuzzystoryclub.com
            </a>{" "}
            or by post at <Review>the company postal address.</Review> Our full company details are
            in our{" "}
            <a href="/imprint" className="font-semibold hover:text-coral">
              Impressum
            </a>
            .
          </p>
        </Section>

        <Section title="What we collect, and why">
          <p>We only ask for what a personalized book actually needs:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold text-ink">Photos</span> of the people in the story,
              usually children, so our illustrators and AI can turn them into storybook characters.
            </li>
            <li>
              <span className="font-semibold text-ink">Names and roles</span> of the cast, so the
              story is truly about them.
            </li>
            <li>
              <span className="font-semibold text-ink">Your family memory</span>, the free-text
              moment you want the book to be built around.
            </li>
            <li>
              <span className="font-semibold text-ink">A dedication and signature</span>, if you add
              one, for the printed dedication page.
            </li>
            <li>
              <span className="font-semibold text-ink">Your email</span>, so we can send your preview
              link and order updates.
            </li>
            <li>
              <span className="font-semibold text-ink">Your shipping address</span> and order
              details, so we can print and post your book.
            </li>
          </ul>
          <p>
            We also receive basic technical data (like your IP address and browser) simply from you
            visiting the site, which is normal for any website and helps us keep it secure and
            running.
          </p>
        </Section>

        <Section title="Legal basis">
          <p>
            We process your data to perform our contract with you, that is, to create and deliver
            your book (GDPR Article 6(1)(b)). Because your photos of children can be sensitive, and
            because AI helps create the artwork, we also rely on the consent you give in the studio
            before we begin (GDPR Article 6(1)(a), and Article 9(2)(a) where special-category data is
            involved). You can withdraw that consent at any time by deleting your book. We keep
            minimal order records to meet our legal and tax obligations (GDPR Article 6(1)(c)).{" "}
            <Review>Confirm the special-category / children's-data basis with counsel.</Review>
          </p>
        </Section>

        <Section title="AI and the partners who help make your book">
          <p>
            Your book is created with the help of AI and print partners. Your content is shared with
            them only to the extent needed to make your book, and only for that purpose. In
            particular, your photos and words are processed by third-party AI models to write the
            story and generate the illustrations.
          </p>
          <div className="mt-2 overflow-x-auto rounded-3xl bg-white/70 shadow-fuzzy ring-1 ring-ink/5">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-ink">
                  <th className="p-4 font-display font-extrabold">Partner</th>
                  <th className="p-4 font-display font-extrabold">What we share</th>
                  <th className="p-4 font-display font-extrabold">Why</th>
                  <th className="p-4 font-display font-extrabold">Where</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {PROCESSORS.map((p) => (
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
          <p>
            We also use Inngest to schedule the background jobs that build your book. It only ever
            sees internal book identifiers, never your photos or your words.
          </p>
          <p>
            Some of these partners are based in the United States, so making your book can involve
            transferring data outside the EEA. Where that happens, we rely on appropriate safeguards
            such as the EU Standard Contractual Clauses and data processing agreements with each
            partner. <Review>Confirm the DPA and SCC status with each sub-processor, and the AI
            partners' input-retention terms.</Review>
          </p>
        </Section>

        <Section title="How long we keep things">
          <p>We do not keep your data any longer than your book needs it:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold text-ink">Source photos</span> are automatically deleted
              30 days after your book ships or is cancelled. The finished book stays viewable, the
              original photos do not linger.
            </li>
            <li>
              <span className="font-semibold text-ink">Your memory text and book content</span> are
              kept only for as long as your book exists. Delete the book and they go with it.
            </li>
            <li>
              <span className="font-semibold text-ink">Order records</span> are kept for as long as
              tax and accounting law requires, but stripped of personal detail once they no longer
              need it.
            </li>
          </ul>
        </Section>

        <Section title="How we protect your book">
          <p>
            Your photos and finished book live in private storage and are never publicly listed. When
            a page needs to show them, we generate a temporary link that expires after seven days.
            Your book itself is reachable only through a long, randomly generated access link, so only
            people you share that link with can open it. We say this clearly in the emails we send.
          </p>
        </Section>

        <Section title="Cookies and analytics">
          <p>
            We keep this simple. We use only the essential cookies needed to run the studio and keep
            your session working. <Review>Confirm the final analytics setup: if analytics run in a
            cookieless, EU-hosted mode, no consent banner is required; update this section
            accordingly.</Review>
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under the GDPR you can ask us to show you the data we hold, correct it, delete it,
            restrict how we use it, or hand it over in a portable form. The easiest way to erase
            everything is to delete your book, which removes the book, the people, the generated art,
            and the stored files. You can also email us at{" "}
            <a href="mailto:privacy@warmfuzzystoryclub.com" className="font-semibold hover:text-coral">
              privacy@warmfuzzystoryclub.com
            </a>{" "}
            and we will take care of it. If a book is actively being printed, we may need to finish or
            cancel that print run first. You also have the right to complain to a data protection
            authority. <Review>Name the competent supervisory authority for the company's country.</Review>
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change how we handle your data, we will update this page and change the date below.
            For anything that materially affects you, we will let you know directly.
          </p>
        </Section>

        <p className="pt-2 text-center text-sm text-ink-soft">Last updated: July 2026.</p>
      </div>
    </div>
  );
}
