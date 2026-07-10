"use client";

import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

/**
 * Deletes a book (and every stored asset) via the GDPR erasure endpoint,
 * after an explicit confirm. Rendered under the account book cards for
 * statuses where deletion is allowed (the API blocks in-production books).
 */
export function DeleteBookButton({
  token,
  label,
  confirmMessage,
  pendingLabel,
}: {
  token: string;
  label: string;
  confirmMessage: string;
  pendingLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(token)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `Delete failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setPending(false);
    }
  }

  return (
    <div className="mt-1.5 text-center">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={pending}
        className="text-xs font-semibold text-ink-soft transition-colors hover:text-coral disabled:opacity-50"
      >
        {pending ? pendingLabel : label}
      </button>
      {error ? <p className="mt-1 text-xs text-coral">{error}</p> : null}
    </div>
  );
}
