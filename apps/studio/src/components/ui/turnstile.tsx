"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget (workstream O5).
 *
 * Explicitly renders the Turnstile challenge and reports the resulting token
 * via `onVerify`. Mount this on the wizard's Finish step and pass the token
 * into the create-book request body as `turnstileToken`.
 *
 * When NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset (local dev), the widget renders
 * nothing and immediately calls onVerify("") so the flow proceeds. The server
 * also skips verification when its secret is unset, so the empty token is fine.
 */

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

interface TurnstileApi {
  render: (el: HTMLElement, opts: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export interface TurnstileProps {
  /** Called with the token on success, or "" on expiry/error/unconfigured. */
  onVerify: (token: string) => void;
  /** Optional analytics/label passed to Turnstile. */
  action?: string;
  className?: string;
}

export function Turnstile({ onVerify, action, className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedRef = useRef(false);
  // Keep the latest onVerify without re-running the mount effect.
  const onVerifyRef = useRef(onVerify);
  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) {
      onVerifyRef.current("");
      return;
    }

    let cancelled = false;
    let widgetId: string | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    const render = () => {
      if (cancelled || renderedRef.current) return;
      if (!containerRef.current || !window.turnstile) return;
      renderedRef.current = true;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: (token: string) => onVerifyRef.current(token),
        "expired-callback": () => onVerifyRef.current(""),
        "error-callback": () => onVerifyRef.current(""),
      });
    };

    if (window.turnstile) {
      render();
    } else if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render);
      document.head.appendChild(script);
    } else {
      poll = setInterval(() => {
        if (window.turnstile) {
          if (poll) clearInterval(poll);
          render();
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
      renderedRef.current = false;
    };
    // Mount-once: onVerify is read through a ref; action is stable in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} />;
}

export default Turnstile;
