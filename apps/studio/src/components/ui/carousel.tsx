"use client";

/**
 * WFSC design system — Carousel.
 * A horizontal, pointer-draggable rail with round arrow buttons and no
 * visible scrollbar. Server components can pass cards straight in as
 * children. Used for the landing categories and inspiration galleries.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function Carousel({
  children,
  className = "",
  itemGap = "gap-4",
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  itemGap?: string;
  ariaLabel?: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Drag state lives in refs — no re-render while dragging.
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });

  const updateArrows = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrows]);

  function nudge(direction: 1 | -1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.75, behavior: "smooth" });
  }

  function onPointerDown(e: React.PointerEvent) {
    const el = railRef.current;
    if (!el || e.pointerType === "touch") return; // touch scrolls natively
    drag.current = { active: true, moved: false, startX: e.clientX, startScroll: el.scrollLeft };
  }

  function onPointerMove(e: React.PointerEvent) {
    const el = railRef.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 6 && !drag.current.moved) {
      drag.current.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    if (drag.current.moved) {
      el.scrollLeft = drag.current.startScroll - dx;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const el = railRef.current;
    if (el && drag.current.moved) el.releasePointerCapture(e.pointerId);
    drag.current.active = false;
    // Swallow the click that follows a real drag so cards don't navigate.
    if (drag.current.moved) {
      const suppress = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      el?.addEventListener("click", suppress, { capture: true, once: true });
      setTimeout(() => el?.removeEventListener("click", suppress, { capture: true }), 0);
    }
  }

  return (
    <div className={`group/carousel relative ${className}`.trim()}>
      <div
        ref={railRef}
        role="region"
        aria-label={ariaLabel}
        className={`no-scrollbar flex ${itemGap} cursor-grab snap-x snap-proximity overflow-x-auto px-1 pb-9 pt-5 active:cursor-grabbing`}
        onScroll={updateArrows}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>

      <CarouselArrow direction="left" hidden={!canLeft} onClick={() => nudge(-1)} />
      <CarouselArrow direction="right" hidden={!canRight} onClick={() => nudge(1)} />
    </div>
  );
}

function CarouselArrow({
  direction,
  hidden,
  onClick,
}: {
  direction: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "Scroll back" : "Scroll forward"}
      onClick={onClick}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white font-display text-lg text-ink shadow-fuzzy transition hover:bg-marigold focus-visible:outline-3 focus-visible:outline-cobalt ${
        direction === "left" ? "-left-2 sm:-left-4" : "-right-2 sm:-right-4"
      } ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  );
}
