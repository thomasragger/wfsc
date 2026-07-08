"use client";

/**
 * WFSC design system — HeroAnimatedBackground.
 * The same UnicornStudio ambient animation used on the Shopify theme's
 * password-page hero. Sits behind hero content; the CSS grainy gradient
 * (.hero-wash) remains as the base layer and shows through until the
 * embed loads, or permanently if the visitor prefers reduced motion.
 * All new UI must come from src/components/ui/* — /styleguide is the living contract.
 */
import Script from "next/script";
import { useSyncExternalStore } from "react";

const DEFAULT_PROJECT_ID = "OA1dHoarDruW6pvS4sNA";
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}
function getServerSnapshot() {
  return false; // unknown pre-hydration; useSyncExternalStore reconciles once mounted.
}

export function HeroAnimatedBackground({
  projectId = DEFAULT_PROJECT_ID,
  className = "",
}: {
  projectId?: string;
  className?: string;
}) {
  const reducedMotion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (reducedMotion) return null;

  return (
    <>
      <div
        data-us-project={projectId}
        className={`pointer-events-none absolute inset-0 ${className}`.trim()}
        aria-hidden="true"
      />
      <Script id="unicornstudio-loader" strategy="afterInteractive">
        {`!function(){if(!window.UnicornStudio){window.UnicornStudio={isInitialized:!1};var i=document.createElement("script");i.src="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.34/dist/unicornStudio.umd.js",i.onload=function(){window.UnicornStudio.isInitialized||(UnicornStudio.init(),window.UnicornStudio.isInitialized=!0)},(document.head||document.body).appendChild(i)}}();`}
      </Script>
    </>
  );
}
