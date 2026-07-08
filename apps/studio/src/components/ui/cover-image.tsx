/**
 * WFSC design system — CoverImage.
 * A plain, square, rounded book-cover tile with the shared tile-lift hover.
 * (Replaces the earlier 3D BookMockup, parked for now — see book-mockup.tsx.)
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
import { ArtPlaceholder } from "@/components/decor";
import { ProgressiveImage } from "@/components/ui/progressive-image";

const SIZES = {
  sm: "clamp(7rem, 30vw, 9.5rem)",
  md: "clamp(10rem, 40vw, 14rem)",
  lg: "clamp(13rem, 60vw, 19rem)",
} as const;

export type CoverImageSize = keyof typeof SIZES;

export function CoverImage({
  src,
  alt = "",
  size = "md",
  className = "",
  priority = false,
}: {
  src: string | null;
  alt?: string;
  size?: CoverImageSize;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`tile-lift aspect-square overflow-hidden rounded-3xl bg-lavender ${className}`.trim()}
      style={{ width: SIZES[size] }}
    >
      {src ? (
        <ProgressiveImage
          src={src}
          alt={alt}
          priority={priority}
          className="h-full w-full"
          imgClassName="h-full w-full object-cover"
        />
      ) : (
        <ArtPlaceholder />
      )}
    </div>
  );
}
