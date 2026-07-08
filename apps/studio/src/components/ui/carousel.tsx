"use client";

/**
 * WFSC design system — Carousel.
 * A physics-driven drag rail: pointer input sets a velocity, an animation
 * loop eases the track toward its target with inertia, and springs back at
 * both ends.
 *
 * Clipping uses `overflow-x: clip` + `overflow-y: visible` (NOT `hidden`,
 * which forces BOTH axes to clip and slices the cards' hover-lift shadow
 * off the bottom). That leaves the vertical shadow free to paint while the
 * rail is still contained horizontally.
 *
 * `fullBleed` runs the rail edge-to-edge across the viewport: the first
 * card still starts aligned to the page column (so it lines up with the
 * heading), but cards flow off BOTH viewport edges as you drag instead of
 * being sliced at a mid-column line with dead space beside them. The left
 * inset is derived with calc(50vw - 50%) so it self-aligns at any width.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";

const FRICTION = 0.9; // velocity decay per frame once released
const SPRING = 0.3; // pull-back strength past the bounds
const FOLLOW_DRAGGING = 0.6; // how tightly the track tracks the pointer while held
const FOLLOW_SETTLING = 0.24; // how tightly the track eases toward its target otherwise
const SETTLE_EPSILON = 0.4;

export function Carousel({
  children,
  className = "",
  itemGap = "gap-4",
  ariaLabel,
  fullBleed = false,
}: {
  children: React.ReactNode;
  className?: string;
  itemGap?: string;
  ariaLabel?: string;
  /** Run the rail edge-to-edge across the viewport (first card stays column-aligned). */
  fullBleed?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Physics state lives in refs — the rAF loop never triggers a re-render.
  const p = useRef({ x: 0, tx: 0, vx: 0, down: false, px: 0, moved: 0, rafId: 0, running: false });
  const trackWidthRef = useRef(0);

  const visibleWidth = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return 0;
    const cs = getComputedStyle(wrap);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    // Bleed mode runs content to the viewport's right edge, so only the left
    // inset counts; bounded mode keeps a gutter on both sides.
    return wrap.clientWidth - padL - (fullBleed ? 0 : padR);
  }, [fullBleed]);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    trackWidthRef.current = track.scrollWidth;
  }, []);

  const minX = useCallback(() => {
    return Math.min(0, visibleWidth() - trackWidthRef.current);
  }, [visibleWidth]);

  const wake = useCallback(() => {
    if (p.current.running) return;
    p.current.running = true;
    p.current.rafId = requestAnimationFrame(glide);
    function glide() {
      const s = p.current;
      const track = trackRef.current;
      if (!track) {
        s.running = false;
        return;
      }
      if (!s.down) {
        s.tx += s.vx;
        s.vx *= FRICTION;
      }

      const lo = minX();
      if (s.tx > 0) s.tx += (0 - s.tx) * SPRING;
      if (s.tx < lo) s.tx += (lo - s.tx) * SPRING;

      s.x += (s.tx - s.x) * (s.down ? FOLLOW_DRAGGING : FOLLOW_SETTLING);
      track.style.transform = `translate3d(${s.x}px,0,0)`;

      setCanLeft(s.tx < -4);
      setCanRight(s.tx > lo + 4);

      const settled = !s.down && Math.abs(s.tx - s.x) < SETTLE_EPSILON && Math.abs(s.vx) < 0.05;
      if (settled) {
        s.running = false;
        return;
      }
      s.rafId = requestAnimationFrame(glide);
    }
  }, [minX]);

  const updateBoundsNow = useCallback(() => {
    measure();
    const lo = minX();
    p.current.tx = Math.max(lo, Math.min(0, p.current.tx));
    setCanLeft(p.current.tx < -4);
    setCanRight(p.current.tx > lo + 4);
  }, [measure, minX]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // ResizeObserver's callback always fires once, asynchronously, right
    // after observe() — that gives us the initial measurement without a
    // synchronous setState call in the effect body.
    const ro = new ResizeObserver(updateBoundsNow);
    ro.observe(wrap);
    if (trackRef.current) ro.observe(trackRef.current);
    const state = p.current;
    return () => {
      ro.disconnect();
      cancelAnimationFrame(state.rafId);
    };
  }, [updateBoundsNow]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    function onPointerDown(e: PointerEvent) {
      const s = p.current;
      s.down = true;
      s.moved = 0;
      s.px = e.clientX;
      s.vx = 0;
      wrap!.classList.add("cursor-grabbing");
      wake();
    }
    function onPointerMove(e: PointerEvent) {
      const s = p.current;
      if (!s.down) return;
      const dx = e.clientX - s.px;
      s.px = e.clientX;
      s.moved += Math.abs(dx);
      if (s.moved > 6 && !wrap!.hasPointerCapture(e.pointerId)) {
        wrap!.setPointerCapture(e.pointerId);
      }
      s.tx += dx;
      s.vx = dx;
    }
    function onPointerEnd(e: PointerEvent) {
      const s = p.current;
      s.down = false;
      s.vx *= 1.4; // a little flick momentum on release
      wrap!.classList.remove("cursor-grabbing");
      if (s.moved > 8) {
        const suppress = (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        wrap!.addEventListener("click", suppress, { capture: true, once: true });
        setTimeout(() => wrap!.removeEventListener("click", suppress, { capture: true }), 0);
      }
      if (wrap!.hasPointerCapture(e.pointerId)) wrap!.releasePointerCapture(e.pointerId);
    }
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      p.current.tx -= e.deltaX;
      e.preventDefault();
      wake();
    }

    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerup", onPointerEnd);
    wrap.addEventListener("pointercancel", onPointerEnd);
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      wrap.removeEventListener("pointerdown", onPointerDown);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerup", onPointerEnd);
      wrap.removeEventListener("pointercancel", onPointerEnd);
      wrap.removeEventListener("wheel", onWheel);
    };
  }, [wake]);

  function nudge(direction: 1 | -1) {
    p.current.tx = Math.max(minX(), Math.min(0, p.current.tx + direction * visibleWidth() * 0.72));
    wake();
  }

  return (
    <div className={`group/carousel relative ${className}`.trim()}>
      <div
        ref={wrapRef}
        role="region"
        aria-label={ariaLabel}
        /* overflow-x:clip + overflow-y:visible clips the rail horizontally
           while letting the cards' vertical hover shadow paint uncut.
           Bounded: -mx-6/px-6 cancel out but push the clip 24px past the
           column so edge cards' shadows show. fullBleed: both margins run to
           the viewport edges (calc(50% - 50vw)); the left inset
           (calc(50vw - 50%)) re-aligns the first card to the page column so
           it lines up with the heading, and cards flow off both edges. */
        className={`${
          fullBleed
            ? "ml-[calc(50%_-_50vw)] mr-[calc(50%_-_50vw)] pl-[calc(50vw_-_50%)]"
            : "-mx-6 px-6"
        } cursor-grab touch-pan-y select-none overflow-x-clip overflow-y-visible pb-10 pt-6`}
      >
        <div ref={trackRef} className={`flex w-max ${itemGap}`} style={{ willChange: "transform" }}>
          {children}
        </div>
      </div>

      <CarouselArrow direction="left" disabled={!canLeft} onClick={() => nudge(-1)} />
      <CarouselArrow direction="right" disabled={!canRight} onClick={() => nudge(1)} />
    </div>
  );
}

function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "Scroll back" : "Scroll forward"}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-fuzzy transition-all duration-200 hover:-translate-y-[calc(50%+2px)] hover:shadow-polaroid focus-visible:outline-3 focus-visible:outline-cobalt ${
        direction === "left" ? "-left-2 sm:-left-4" : "-right-2 sm:-right-4"
      } ${disabled ? "pointer-events-none opacity-30" : "opacity-100 hover:bg-marigold"}`}
    >
      {direction === "left" ? <IconChevronLeft /> : <IconChevronRight />}
    </button>
  );
}
