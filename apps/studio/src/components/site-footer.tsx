import Image from "next/image";
import Link from "next/link";

import { Doodle } from "@/components/decor";
import type { AudienceCategory, OccasionCategory } from "@/lib/categories";

/** Marketing footer — internal links + a peek at the category axes. */
export function SiteFooter({
  audience,
  occasions,
}: {
  audience: AudienceCategory[];
  occasions: OccasionCategory[];
}) {
  return (
    <footer className="relative mt-20 overflow-hidden border-t border-ink/5 bg-white/50 backdrop-blur-sm">
      <Doodle src="cloud.png" size={44} className="animate-float absolute right-[8%] top-4 opacity-70" />
      <Doodle src="flower.png" size={26} className="animate-drift absolute bottom-6 left-[6%] opacity-70" />
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={30} height={36} />
            <p className="font-display font-extrabold text-ink">Warm Fuzzy Story Club</p>
          </div>
          <p className="mt-3 text-sm text-ink-soft">Turning memories into art for a lifetime.</p>
        </div>

        <FooterCol title="Explore">
          <FooterLink href="/create">Write your story</FooterLink>
          <FooterLink href="/books">Our books</FooterLink>
          <FooterLink href="/samples">Sample books</FooterLink>
        </FooterCol>

        <FooterCol title="Who it's for">
          {audience.slice(0, 6).map((c) => (
            <FooterLink key={c.id} href={`/for/${c.id}`}>
              {c.name}
            </FooterLink>
          ))}
        </FooterCol>

        <FooterCol title="Occasions">
          {occasions.slice(0, 6).map((c) => (
            <FooterLink key={c.id} href={`/occasions/${c.id}`}>
              {c.name}
            </FooterLink>
          ))}
        </FooterCol>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-wide text-ink/50">{title}</p>
      <nav className="flex flex-col gap-2 text-sm font-semibold text-ink-soft">{children}</nav>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="hover:text-coral">
      {children}
    </Link>
  );
}
