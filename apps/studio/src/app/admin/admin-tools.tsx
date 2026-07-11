"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, TextInput } from "@/components/ui/input";

interface BookRow {
  token: string;
  title: string | null;
  status: string;
  locale: string | null;
  created_at: string;
  email: string | null;
  is_sample: boolean;
}

const EMAIL_TYPES = [
  { value: "previewReady", label: "Preview ready (link)" },
  { value: "reviewReady", label: "Review ready (link)" },
  { value: "printSubmitted", label: "Print submitted (notice)" },
  { value: "generationDelayed", label: "Generation delayed (notice)" },
];

type Note = { kind: "ok" | "err"; text: string } | null;

function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p className={`text-sm font-semibold ${note.kind === "ok" ? "text-green-700" : "text-red-700"}`}>
      {note.text}
    </p>
  );
}

// --- Test emails --------------------------------------------------------------

function EmailTestPanel() {
  const [type, setType] = useState("previewReady");
  const [locale, setLocale] = useState("en");
  const [to, setTo] = useState("");
  const [note, setNote] = useState<Note>(null);
  const [pending, setPending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, locale, to }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; subject?: string };
      setNote(
        res.ok
          ? { kind: "ok", text: `Sent "${data.subject}" to ${to}.` }
          : { kind: "err", text: data.error ?? "Send failed." },
      );
    } catch {
      setNote({ kind: "err", text: "Network error." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-3 font-display text-lg font-bold text-ink">Test emails</h2>
      <form onSubmit={send} className="grid gap-3 sm:grid-cols-2">
        <Field label="Template" htmlFor="email-type">
          <Select id="email-type" value={type} onChange={(e) => setType(e.target.value)}>
            {EMAIL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Locale" htmlFor="email-locale">
          <Select id="email-locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="en">en</option>
            <option value="de">de</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Recipient" htmlFor="email-to" hint="Uses realistic fake book data.">
            <TextInput
              id="email-to"
              type="email"
              placeholder="you@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" pending={pending} pendingLabel="Sending...">
            Send test email
          </Button>
          <NoteLine note={note} />
        </div>
      </form>
    </Card>
  );
}

// --- Book / account lookup ----------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-ink">
      {status}
    </span>
  );
}

function BookRowItem({ row, onDeleted }: { row: BookRow; onDeleted: (token: string) => void }) {
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [pending, setPending] = useState(false);

  async function del() {
    setNote(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/delete-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: row.token, confirmToken: confirm }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        onDeleted(row.token);
        return;
      }
      setNote({ kind: "err", text: data.error ?? "Delete failed." });
    } catch {
      setNote({ kind: "err", text: "Network error." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge status={row.status} />
        <span className="font-semibold text-ink">{row.title ?? "(untitled)"}</span>
        {row.is_sample ? (
          <span className="rounded-full bg-marigold/30 px-2 py-0.5 text-xs font-semibold text-ink">
            sample
          </span>
        ) : null}
        <span className="text-ink-soft">{row.locale ?? "-"}</span>
        <a
          href={`/book/${row.token}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-coral underline"
        >
          {row.token}
        </a>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-soft">
        <span>{row.email ?? "(no email)"}</span>
        <span>{new Date(row.created_at).toLocaleString()}</span>
      </div>

      {row.is_sample ? (
        <p className="mt-2 text-xs text-ink-soft">Sample books cannot be deleted here.</p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-xs font-semibold text-red-700 underline"
        >
          Delete this book
        </button>
      ) : (
        <div className="mt-2 flex flex-col gap-2 rounded-lg bg-red-50 p-3">
          <p className="text-xs text-ink">
            Type the token <span className="font-mono">{row.token}</span> to confirm full erasure.
          </p>
          <TextInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Paste the token"
            className="text-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={confirm !== row.token}
              pending={pending}
              pendingLabel="Deleting..."
              onClick={del}
            >
              Erase permanently
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <NoteLine note={note} />
          </div>
        </div>
      )}
    </div>
  );
}

function BookSearchPanel() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<BookRow[] | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [pending, setPending] = useState(false);

  // Bulk delete-by-email state.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState("");
  const [bulkNote, setBulkNote] = useState<Note>(null);
  const [bulkPending, setBulkPending] = useState(false);

  const emailQuery = query.includes("@") ? query.trim() : "";

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    setPending(true);
    setBulkOpen(false);
    setBulkConfirm("");
    setBulkNote(null);
    try {
      const res = await fetch("/api/admin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json().catch(() => ({}))) as { rows?: BookRow[]; error?: string };
      if (res.ok) {
        setRows(data.rows ?? []);
      } else {
        setNote({ kind: "err", text: data.error ?? "Search failed." });
      }
    } catch {
      setNote({ kind: "err", text: "Network error." });
    } finally {
      setPending(false);
    }
  }

  async function bulkDelete() {
    setBulkNote(null);
    setBulkPending(true);
    try {
      const res = await fetch("/api/admin/delete-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailQuery, confirmEmail: bulkConfirm }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
        skipped?: unknown[];
      };
      if (res.ok) {
        setBulkNote({
          kind: "ok",
          text: `Deleted ${data.deleted ?? 0} book(s). Skipped ${data.skipped?.length ?? 0}.`,
        });
        setRows((prev) => (prev ? prev.filter((r) => r.is_sample) : prev));
        setBulkOpen(false);
        setBulkConfirm("");
      } else {
        setBulkNote({ kind: "err", text: data.error ?? "Bulk delete failed." });
      }
    } catch {
      setBulkNote({ kind: "err", text: "Network error." });
    } finally {
      setBulkPending(false);
    }
  }

  const deletableForEmail = rows?.filter((r) => !r.is_sample).length ?? 0;

  return (
    <Card className="p-5">
      <h2 className="mb-3 font-display text-lg font-bold text-ink">Books &amp; accounts</h2>
      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Field label="Search by email or token" htmlFor="search-q">
            <TextInput
              id="search-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="name@example.com or access token"
            />
          </Field>
        </div>
        <Button type="submit" pending={pending} pendingLabel="Searching...">
          Search
        </Button>
      </form>
      <NoteLine note={note} />

      <p className="mt-3 text-xs text-ink-soft">
        Shopify customer records live in Shopify and must be deleted there.
      </p>

      {rows ? (
        rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">No books found.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {rows.map((r) => (
              <BookRowItem
                key={r.token}
                row={r}
                onDeleted={(token) => setRows((prev) => (prev ? prev.filter((x) => x.token !== token) : prev))}
              />
            ))}

            {emailQuery && deletableForEmail > 0 ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                {!bulkOpen ? (
                  <button
                    type="button"
                    onClick={() => setBulkOpen(true)}
                    className="text-sm font-semibold text-red-700 underline"
                  >
                    Delete everything for {emailQuery} ({deletableForEmail} non-sample)
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-ink">
                      This erases all {deletableForEmail} non-sample book(s) for{" "}
                      <span className="font-mono">{emailQuery}</span>. Type the email to confirm.
                    </p>
                    <TextInput
                      value={bulkConfirm}
                      onChange={(e) => setBulkConfirm(e.target.value)}
                      placeholder="Type the email address"
                      className="text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={bulkConfirm.trim().toLowerCase() !== emailQuery.toLowerCase()}
                        pending={bulkPending}
                        pendingLabel="Deleting..."
                        onClick={bulkDelete}
                      >
                        Erase all
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setBulkOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                <NoteLine note={bulkNote} />
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </Card>
  );
}

export function AdminTools() {
  return (
    <div className="flex flex-col gap-6">
      <EmailTestPanel />
      <BookSearchPanel />
    </div>
  );
}
