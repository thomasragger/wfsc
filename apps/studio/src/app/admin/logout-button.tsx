"use client";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }
  return (
    <Button variant="ghost" size="sm" onClick={logout}>
      Sign out
    </Button>
  );
}
