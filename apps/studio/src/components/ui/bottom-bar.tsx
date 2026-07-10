"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * WFSC design system — BottomBar.
 * A full-viewport-width action bar pinned to the bottom of the screen.
 * Portals to <body>: ancestors with transforms (page transitions) re-anchor
 * position:fixed, which would pin the bar to the container instead of the
 * viewport. Safe-area aware. Renders after mount (portals need a document).
 */
export function BottomBar({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Post-mount flip is the point (SSR has no document for the portal); the
  // sync setState is intentional and settles in one extra render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-cream/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
      {children}
    </div>,
    document.body,
  );
}
