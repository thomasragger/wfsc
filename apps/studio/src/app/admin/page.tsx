import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { adminRecentBooks, adminStatusCounts } from "@/lib/admin-books";
import { isAdminEnabled, isAuthed } from "@/lib/admin-auth";

import { AdminLogin } from "./admin-login";
import { AdminTools } from "./admin-tools";
import { LogoutButton } from "./logout-button";

/** Env vars surfaced as set/unset chips. Values are NEVER read or shown. */
const ENV_CHIPS: { label: string; keys: string[] }[] = [
  { label: "RESEND_API_KEY", keys: ["RESEND_API_KEY"] },
  { label: "SHOPIFY_*", keys: ["SHOPIFY_ADMIN_TOKEN", "SHOPIFY_SHOP_DOMAIN", "SHOPIFY_STOREFRONT_TOKEN"] },
  { label: "LULU_*", keys: ["LULU_CLIENT_KEY", "LULU_CLIENT_SECRET"] },
  { label: "NEXT_PUBLIC_SITE_URL", keys: ["NEXT_PUBLIC_SITE_URL"] },
  { label: "STUDIO_URL", keys: ["STUDIO_URL"] },
  { label: "ADMIN_SECRET", keys: ["ADMIN_SECRET"] },
];

function EnvChip({ label, set }: { label: string; set: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        set ? "bg-sage/25 text-ink" : "bg-rose/25 text-ink"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${set ? "bg-sage" : "bg-rose"}`} />
      {label}: {set ? "set" : "unset"}
    </span>
  );
}

export default async function AdminPage() {
  // Fail closed: the whole area does not exist unless ADMIN_SECRET is set.
  if (!isAdminEnabled()) notFound();

  if (!(await isAuthed())) {
    return <AdminLogin />;
  }

  const [{ counts, total }, recent] = await Promise.all([
    adminStatusCounts(),
    adminRecentBooks(10),
  ]);
  const statusEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">WFSC Admin</h1>
          <p className="text-sm text-ink-soft">Internal tools. {total} books total.</p>
        </div>
        <LogoutButton />
      </header>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Environment</h2>
        <div className="flex flex-wrap gap-2">
          {ENV_CHIPS.map((chip) => (
            <EnvChip
              key={chip.label}
              label={chip.label}
              set={chip.keys.every((k) => Boolean(process.env[k]))}
            />
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Books by status</h2>
        {statusEntries.length === 0 ? (
          <p className="text-sm text-ink-soft">No books yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {statusEntries.map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-sm text-ink"
              >
                <span className="font-semibold">{count}</span>
                <span className="text-ink-soft">{status}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Last 10 books</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-soft">No books yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-1 pr-3">Created</th>
                  <th className="py-1 pr-3">Title</th>
                  <th className="py-1 pr-3">Status</th>
                  <th className="py-1 pr-3">Locale</th>
                  <th className="py-1 pr-3">Email</th>
                  <th className="py-1 pr-3">Token</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.token} className="border-t border-black/5">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-ink-soft">
                      {new Date(b.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 pr-3 text-ink">
                      {b.title ?? "(untitled)"}
                      {b.is_sample ? <span className="ml-1 text-ink-soft">(sample)</span> : null}
                    </td>
                    <td className="py-1.5 pr-3 text-ink">{b.status}</td>
                    <td className="py-1.5 pr-3 text-ink-soft">{b.locale ?? "-"}</td>
                    <td className="py-1.5 pr-3 text-ink-soft">{b.email ?? "-"}</td>
                    <td className="py-1.5 pr-3">
                      <a
                        href={`/book/${b.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-coral underline"
                      >
                        {b.token.slice(0, 12)}…
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdminTools />
    </div>
  );
}
