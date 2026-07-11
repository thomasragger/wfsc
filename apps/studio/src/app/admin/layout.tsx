import type { Metadata } from "next";

/**
 * Internal admin area (M-admin). Lives OUTSIDE the [locale] tree so it is never
 * locale-prefixed; English-only, hardcoded strings, no next-intl keys. Always
 * noindex — reinforced by robots.txt disallowing /admin.
 */
export const metadata: Metadata = {
  title: "WFSC Admin",
  robots: { index: false, follow: false, nocache: true },
};

// Never statically render: everything depends on the request cookie + live DB.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div id="main-content" className="min-h-full bg-cream px-4 py-8 sm:px-6">{children}</div>;
}
