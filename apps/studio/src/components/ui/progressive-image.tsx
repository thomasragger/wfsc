"use client";

import { useCallback, useState } from "react";

/**
 * WFSC design system — ProgressiveImage.
 * An <img> that loads gracefully instead of popping in: a lavender shimmer
 * holds the space, then the image blur-ups + fades in once decoded. Cached
 * or SSR-complete images resolve instantly via the ref callback (no stuck
 * shimmer, and no set-state-in-effect).
 *
 * `className` styles the framed box (size / rounding / aspect); `imgClassName`
 * styles the image itself (object-fit etc). The fade is driven by inline
 * style so it never fights a Tailwind `transition-*` utility on the image.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
export function ProgressiveImage({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  priority = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  // Ref callback (not an effect) catches images already complete from cache
  // or SSR before React attaches onLoad — otherwise the shimmer would hang.
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`.trim()}>
      <div
        aria-hidden="true"
        className="animate-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-lavender via-white to-lavender transition-opacity duration-500"
        style={{ opacity: loaded ? 0 : 1 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        className={imgClassName}
        style={{
          opacity: loaded ? 1 : 0,
          filter: loaded ? "blur(0)" : "blur(12px)",
          transition: "opacity 0.7s ease, filter 0.7s ease",
        }}
      />
    </div>
  );
}
