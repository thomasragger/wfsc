import { Link } from "@/i18n/navigation";
import { ArtPlaceholder } from "@/components/decor";
import { IconArrowRight } from "@/components/ui/icons";
import { ProgressiveImage } from "@/components/ui/progressive-image";

/**
 * WFSC design system — ProductCard.
 * THE card for template/sample listings (category pages, samples gallery,
 * related grids): a familiar e-commerce pattern — white card, square art,
 * left-aligned title + subline with real margins, and an explicit CTA row
 * pinned to the bottom edge so every card in a grid aligns regardless of
 * text length. Fills its grid cell; the grid owns the geometry.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
export function ProductCard({
  href,
  onClick,
  image,
  hoverImage = null,
  title,
  subtitle,
  tag,
  ctaLabel,
  priority = false,
}: {
  /** Link target — or pass `onClick` instead to render as a button. */
  href?: string;
  onClick?: () => void;
  image: string | null;
  /** Cross-faded in on hover (e.g. flat art over the 3D mockup). */
  hoverImage?: string | null;
  title: string;
  subtitle?: string | null;
  /** Small pill pinned to the art's top-right corner (e.g. the category). */
  tag?: string | null;
  ctaLabel: string;
  priority?: boolean;
}) {
  const className =
    "tile-lift group flex h-full w-full flex-col overflow-hidden rounded-3xl bg-white text-left shadow-fuzzy ring-1 ring-ink/5";
  const body = (
    <>
      <div className="relative aspect-square w-full overflow-hidden bg-cream">
        {image ? (
          <ProgressiveImage
            src={image}
            alt=""
            priority={priority}
            className={`h-full w-full transition-opacity duration-300 ${hoverImage ? "group-hover:opacity-0" : ""}`}
            imgClassName="h-full w-full object-cover"
          />
        ) : (
          <ArtPlaceholder />
        )}
        {hoverImage ? (
          <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <ProgressiveImage
              src={hoverImage}
              alt=""
              className="h-full w-full"
              imgClassName="h-full w-full object-cover"
            />
          </div>
        ) : null}
        {tag ? (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink shadow-sm">
            {tag}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4 text-left">
        {/* Reserve two title lines so 1- and 2-line headlines occupy identical
            space and every card in a row shares the same internal geometry. */}
        <p className="line-clamp-2 min-h-[2.5rem] font-display text-[0.95rem] font-extrabold leading-snug text-ink">{title}</p>
        {subtitle ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">{subtitle}</p>
        ) : null}
        {/* Button-styled CTA (a span: the whole card is the interactive
            element, so no nested link/button). Soft at rest, solid on hover. */}
        <span className="mt-auto flex w-full pt-3">
          <span className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-coral/10 px-3 py-2 font-display text-sm font-bold text-coral transition-colors group-hover:bg-coral group-hover:text-white">
            {ctaLabel}
            <IconArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} draggable={false} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}
