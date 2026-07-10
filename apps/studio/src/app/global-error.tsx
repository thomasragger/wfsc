"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Root-level error boundary: reports to Sentry and shows a minimal branded
 * fallback (workstream O4 owns the full styled error pages; keep this one
 * dependency-free since the root layout itself may have crashed).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

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
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, maxWidth: 420 }}>
            Our team has been notified. Please refresh the page or come back in
            a moment — your story is safe.
          </p>
        </div>
      </body>
    </html>
  );
}
