import { Doodle } from "@/components/decor";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata = {
  title: "About",
  description:
    "Why we make personalized storybooks: to turn your family's real moments into a keepsake your child asks for again and again.",
};

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

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="relative text-center">
        <Doodle src="sun.png" size={48} className="animate-drift absolute left-[5%] top-0 hidden sm:block" />
        <Doodle src="cloud.png" size={44} className="animate-float absolute right-[7%] top-4 hidden sm:block" />
        <Doodle src="heart-small.png" size={24} className="animate-twinkle absolute left-[30%] top-8 hidden sm:block" />
        <Eyebrow className="mx-auto">Our story about your stories</Eyebrow>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold text-ink sm:text-5xl">
          A warm fuzzy is a feeling. We put it in a book.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-soft">
          Warm Fuzzy Story Club turns the small, real moments of your family into an illustrated
          storybook with your people at the heart of it.
        </p>
      </header>

      <div className="mt-12 space-y-10">
        <Section title="Why we started">
          <p>
            The best bedtime stories are the ones a child asks for again and again. We noticed those
            were almost never the glossy ones off the shelf. They were the made-up ones about your
            own family: the day the dog ate the birthday cake, the move to the new house, the little
            brother who finally arrived. Those stories are precious, and they usually vanish the
            moment the lights go out.
          </p>
          <p>
            We wanted to catch them and give them a cover, so they could be read a hundred times and
            kept forever.
          </p>
        </Section>

        <Section title="How it works">
          <p>
            You tell us about a moment that matters and add a few photos of the people in it. Our
            illustrators and AI turn those photos into storybook characters who look like your
            family, and weave your memory into a real, printed tale. You see a full preview before
            you ever pay, and you only order once it feels right.
          </p>
          <p>
            Every art style you can choose begins with a real illustrator's world, not a generic
            filter. You can meet the styles on our{" "}
            <a href="/artists" className="font-semibold hover:text-coral">
              artists
            </a>{" "}
            page.
          </p>
        </Section>

        <Section title="What we care about">
          <p>
            Your family's privacy comes first. You are trusting us with photos of your children, and
            we treat that seriously: we use your photos and words only to make your book, we never
            sell your data, and we delete your source photos once your book is delivered. You can read
            exactly how in our{" "}
            <a href="/privacy" className="font-semibold hover:text-coral">
              privacy
            </a>{" "}
            page.
          </p>
          <p>
            We also care about craft. A book should feel like a keepsake, printed well, written with
            heart, and worth reading long after your child has grown.
          </p>
        </Section>

        <Section title="Say hello">
          <p>
            We are a small team and we read every message. If you have a question, an idea, or you are
            an illustrator who would like to see your style in the club, find us on our{" "}
            <a href="/contact" className="font-semibold hover:text-coral">
              contact
            </a>{" "}
            page.
          </p>
        </Section>
      </div>

      <section className="mt-14 rounded-3xl bg-lavender/60 p-8 text-center">
        <p className="font-display text-xl font-extrabold text-ink">
          Your family's next favourite book does not exist yet. Let us make it.
        </p>
        <ButtonLink href="/create" size="lg" className="mt-5">
          Start your story
        </ButtonLink>
      </section>
    </div>
  );
}
