import { Doodle } from "@/components/decor";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata = {
  title: "Contact",
  description:
    "How to reach the humans at Warm Fuzzy Story Club: help with an order, a privacy request, or an artist collaboration.",
};

/**
 * Contact page (English draft). Real, structured contact detail rather than a
 * lone mailto link: purpose-specific addresses, response times, and what to
 * include. Facts needing D1 (postal address) are marked with [LEGAL REVIEW].
 */
function Review({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-marigold/40 px-1.5 py-0.5 font-bold text-ink">
      [LEGAL REVIEW] {children}
    </mark>
  );
}

const CHANNELS: {
  emoji: string;
  title: string;
  body: string;
  email: string;
  subject: string;
}[] = [
  {
    emoji: "💬",
    title: "Help with your book or order",
    body: "Questions before you buy, help while you create, or anything about an order you have placed.",
    email: "hello@warmfuzzystoryclub.com",
    subject: "I need a hand with my book",
  },
  {
    emoji: "🔒",
    title: "Privacy and your data",
    body: "Delete your data, get a copy of what we hold, or ask anything about how we handle your photos.",
    email: "privacy@warmfuzzystoryclub.com",
    subject: "Privacy request",
  },
  {
    emoji: "🎨",
    title: "Artists and partnerships",
    body: "You are an illustrator and would love your style in the club, or you have a partnership idea.",
    email: "hello@warmfuzzystoryclub.com",
    subject: "Artist collaboration",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="sun.png" size={44} className="animate-drift absolute left-[5%] top-0 hidden sm:block" />
        <Doodle src="heart-small.png" size={26} className="animate-twinkle absolute right-[8%] top-4 hidden sm:block" />
        <Eyebrow className="mx-auto">Say hello</Eyebrow>
        <h1 className="mx-auto mt-4 font-display text-4xl font-extrabold text-ink sm:text-5xl">
          Contact us
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-soft">
          There are real people behind Warm Fuzzy Story Club, and we love hearing from you. Pick the
          note below that fits, and we will get back to you soon.
        </p>
      </header>

      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {CHANNELS.map((c) => (
          <div
            key={c.title}
            className="flex flex-col rounded-3xl bg-white/70 p-6 shadow-fuzzy ring-1 ring-ink/5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-lavender/70 text-xl">
              {c.emoji}
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
        ))}
      </div>

      <section className="mt-8 rounded-3xl bg-marigold/15 p-6 sm:p-8">
        <h2 className="font-display text-xl font-extrabold text-ink">
          Help us help you faster
        </h2>
        <p className="mt-2 text-ink-soft">
          If your message is about an existing order, popping these in your email saves a round trip:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-soft">
          <li>Your order number, if you have one.</li>
          <li>The email address you used to order.</li>
          <li>For a damaged or faulty book, a quick photo of the problem.</li>
        </ul>
        <p className="mt-4 text-ink-soft">
          We usually reply within <Review>the committed customer-support response time.</Review>
        </p>
      </section>

      <section className="mt-8 rounded-3xl bg-white/70 p-6 shadow-fuzzy ring-1 ring-ink/5 sm:p-8">
        <h2 className="font-display text-xl font-extrabold text-ink">By post</h2>
        <p className="mt-2 text-ink-soft">
          Prefer paper? You can write to us at <Review>the company postal address.</Review> Our full
          legal details live in the{" "}
          <a href="/imprint" className="font-semibold hover:text-coral">
            Impressum
          </a>
          .
        </p>
      </section>

      <div className="mt-12 text-center">
        <p className="font-display text-lg font-bold text-ink">Ready to make something warm?</p>
        <ButtonLink href="/create" className="mt-4">
          Start your story
        </ButtonLink>
      </div>
    </div>
  );
}
