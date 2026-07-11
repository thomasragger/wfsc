"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/input";

/** Minimal passphrase gate. On success the cookie is set server-side; reload. */
export function AdminLogin() {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Login failed.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 pt-16">
      <h1 className="text-center font-display text-2xl font-bold text-ink">WFSC Admin</h1>
      <Card className="p-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Passphrase" htmlFor="admin-passphrase">
            <TextInput
              id="admin-passphrase"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </Field>
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          <Button type="submit" pending={pending} pendingLabel="Checking...">
            Enter
          </Button>
        </form>
      </Card>
    </div>
  );
}
