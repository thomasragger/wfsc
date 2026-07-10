import { Doodle } from "@/components/decor";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata = {
  title: "Terms · Warm Fuzzy Story Club",
  description:
    "The simple agreement between you and Warm Fuzzy Story Club when you create and order a personalized book.",
};

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

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="sun.png" size={44} className="animate-drift absolute left-[5%] top-0 hidden sm:block" />
        <Doodle src="flower.png" size={26} className="animate-float absolute right-[7%] top-4 hidden sm:block" />
        <Eyebrow className="mx-auto">The fine print, kept kind</Eyebrow>
        <h1 className="mx-auto mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          Terms of service
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">
          These are the terms for using Warm Fuzzy Story Club and ordering a book. We have kept them
          as plain as we can.
        </p>
      </header>

      <div className="mt-12 space-y-10">
        <Section title="Who you are agreeing with">
          <p>
            These terms are between you and <Review>the WFSC legal entity name and address.</Review>{" "}
            Throughout this page we call ourselves WFSC or we, and we call you you. Our full company
            details are in our{" "}
            <a href="/imprint" className="font-semibold hover:text-coral">
              Impressum
            </a>
            .
          </p>
        </Section>

        <Section title="What we do">
          <p>
            WFSC lets you create a personalized illustrated storybook from your photos and a family
            memory. We use AI and print partners to turn what you give us into a preview, and, once
            you order, into a printed or digital book. Because every book is made just for you, each
            one is unique.
          </p>
        </Section>

        <Section title="Using the studio">
          <p>
            You need to be at least 18 years old, or have a parent or guardian agree on your behalf,
            to place an order. When you upload photos and text, you promise that you have the right to
            use them, and that you have the consent of anyone shown in the photos, especially the
            parent or guardian of any child. Please do not upload anything unlawful, hateful, or that
            infringes someone else's rights. We may decline or stop an order that breaks these rules.
          </p>
        </Section>

        <Section title="Your content and who owns what">
          <p>
            Your photos and your words stay yours. You give us the permission we need to use them to
            create, preview, print, and deliver your book, and to keep it available for you to view,
            as described in our{" "}
            <a href="/privacy" className="font-semibold hover:text-coral">
              Privacy
            </a>{" "}
            page. When your order is complete, the finished personalized book is yours to enjoy,
            print copies of through us, and share with your family. The underlying art styles,
            templates, software, and brand remain ours.
          </p>
        </Section>

        <Section title="Previews, prices, and orders">
          <p>
            Creating a preview is free. A preview is a draft: small details may shift between the
            preview and the final printed book, and colours can look slightly different on screen
            versus in print. Prices are shown in the studio before you pay and currently range from
            39 to 69 euros depending on the format you choose, for example a board book or a
            hardcover. Prices include VAT where it applies. Your order is confirmed once payment is
            complete and we send you a confirmation. Payment and checkout are handled by our payment
            partner.
          </p>
        </Section>

        <Section title="Printing and delivery">
          <p>
            Printed books are produced and shipped by our print partner. We will share an estimated
            production and delivery time at checkout. Those times are estimates, not guarantees, and
            can be affected by the carrier. <Review>Confirm final production and delivery
            timeframes and shipping regions.</Review>
          </p>
        </Section>

        <Section title="Cancellations, returns, and the right of withdrawal">
          <p>
            Because our books are personalized and made just for you, the ordinary 14-day EU right of
            withdrawal does not apply once production has begun. The full details, including the
            window before production starts and what happens if something arrives damaged or faulty,
            are on our{" "}
            <a href="/returns" className="font-semibold hover:text-coral">
              Returns and withdrawal
            </a>{" "}
            page. Your statutory warranty rights are unaffected.
          </p>
        </Section>

        <Section title="If something goes wrong">
          <p>
            We want you to love your book. If it arrives damaged, faulty, or not matching your
            approved order, tell us and we will reprint or refund it. Beyond that, and to the extent
            the law allows, WFSC is not liable for indirect or unforeseeable losses, and nothing in
            these terms limits liability that cannot be limited by law, such as for death or personal
            injury caused by negligence. <Review>Have counsel set the liability and warranty wording
            for the company's jurisdiction.</Review>
          </p>
        </Section>

        <Section title="Changes and governing law">
          <p>
            We may update these terms from time to time. If we make a material change, we will post
            the new version here with an updated date. These terms are governed by{" "}
            <Review>the governing law and jurisdiction for the company's country.</Review> If any part
            of these terms is found invalid, the rest still applies.
          </p>
        </Section>

        <Section title="Talk to us">
          <p>
            Questions about these terms? Reach us any time on our{" "}
            <a href="/contact" className="font-semibold hover:text-coral">
              Contact
            </a>{" "}
            page.
          </p>
        </Section>

        <p className="pt-2 text-center text-sm text-ink-soft">Last updated: July 2026.</p>
      </div>
    </div>
  );
}
