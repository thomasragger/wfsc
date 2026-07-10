import { Doodle } from "@/components/decor";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata = {
  title: "Returns and withdrawal",
  description:
    "Your 14-day EU right of withdrawal, the exception for personalized books, and how we make things right if your book arrives damaged.",
};

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

export default function ReturnsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="heart.png" size={40} className="animate-drift absolute left-[5%] top-0 hidden sm:block" />
        <Doodle src="cloud.png" size={40} className="animate-float absolute right-[6%] top-4 hidden sm:block" />
        <Eyebrow className="mx-auto">Made just for you</Eyebrow>
        <h1 className="mx-auto mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          Returns and right of withdrawal
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">
          Because every book is personalized, the rules are a little different from an off-the-shelf
          product. Here is what applies, and how we look after you either way.
        </p>
      </header>

      <div className="mt-10 rounded-3xl bg-lavender/60 p-6 leading-relaxed text-ink sm:p-8">
        <p className="font-display text-lg font-extrabold">In one breath</p>
        <p className="mt-2 text-ink-soft">
          Personalized books are exempt from the standard 14-day withdrawal right once we start
          making them. But if anything arrives damaged, faulty, or wrong, we will always put it
          right. And you can cancel free of charge any time before production begins.
        </p>
      </div>

      <div className="mt-12 space-y-10">
        <Section title="The 14-day right of withdrawal">
          <p>
            For most things you buy online in the EU, you have the right to withdraw from the
            contract within 14 days without giving a reason. That is a real and important consumer
            right, and it is the starting point.
          </p>
        </Section>

        <Section title="Why personalized books are an exception">
          <p>
            Our books are made to your specification and are clearly personal to you: your photos,
            your family's names, your memory, your dedication. Under EU consumer law, the right of
            withdrawal does not apply to goods that are made to the consumer's specifications or are
            clearly personalized. In Germany this exception is set out in Article 246a EGBGB and
            Section 312g paragraph 2 number 1 of the German Civil Code (BGB).
          </p>
          <p>
            In practice this means: once you approve your book and production begins, the order can no
            longer be withdrawn simply because you changed your mind, because we cannot resell a book
            made about your family. You confirm and acknowledge this before you pay.{" "}
            <Review>Confirm the exact point at which the withdrawal right lapses (order approval vs.
            print start) with counsel, and align it with the checkout consent wording.</Review>
          </p>
        </Section>

        <Section title="Cancelling before production starts">
          <p>
            Before we begin producing your book, you can cancel your order for a full refund, no
            reason needed. Creating and viewing a preview is always free and never commits you to
            anything. Just reach us on the{" "}
            <a href="/contact" className="font-semibold hover:text-coral">
              Contact
            </a>{" "}
            page and we will sort it out.
          </p>
        </Section>

        <Section title="If your book arrives damaged, faulty, or wrong">
          <p>
            The personalization exception does not touch your statutory rights. If your book turns up
            damaged, has a printing fault, or does not match the order you approved, that is on us. Let
            us know within a reasonable time, ideally with a photo of the problem, and we will reprint
            it or refund you. You do not lose these rights, and this exception never applies to a
            faulty product.
          </p>
        </Section>

        <Section title="How to reach us about an order">
          <p>
            Email{" "}
            <a href="mailto:hello@warmfuzzystoryclub.com" className="font-semibold hover:text-coral">
              hello@warmfuzzystoryclub.com
            </a>{" "}
            with your order number and, if it is a damage or fault, a quick photo. You can find more
            ways to reach us on our{" "}
            <a href="/contact" className="font-semibold hover:text-coral">
              Contact
            </a>{" "}
            page. We aim to reply within{" "}
            <Review>the committed customer-support response time.</Review>
          </p>
        </Section>

        <p className="pt-2 text-center text-sm text-ink-soft">Last updated: July 2026.</p>
      </div>
    </div>
  );
}
