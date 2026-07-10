"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, type CSSProperties } from "react";

/**
 * Root-level error boundary: reports to Sentry and shows a branded fallback.
 * Kept deliberately dependency-free (inline styles, brand PNGs served from
 * /public, no Tailwind/font imports) because the root layout itself may have
 * crashed, so none of the app CSS or providers can be assumed to be present.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const buttonBase: CSSProperties = {
    display: "inline-block",
    borderRadius: 9999,
    padding: "12px 22px",
    fontSize: 15,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    border: "none",
  };

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "Quicksand, 'Helvetica Neue', sans-serif",
          background: "#fffaf7",
          color: "#761e0b",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 460 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascot/part1.png"
            alt=""
            width={140}
            height={140}
            style={{ width: 128, height: "auto", margin: "0 auto 8px" }}
          />
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>Well, that&rsquo;s a plot twist</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, margin: "0 auto 24px", color: "#a15b44" }}>
            Something hiccuped on our end and our team has been notified. Your story is safe. Please
            refresh, or come back in a moment.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ ...buttonBase, background: "#ff6f5e", color: "#ffffff" }}
            >
              Refresh
            </button>
            <a href="/" style={{ ...buttonBase, background: "#ffffff", color: "#761e0b" }}>
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
