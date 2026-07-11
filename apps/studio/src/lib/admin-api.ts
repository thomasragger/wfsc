import { NextResponse } from "next/server";

import { isAdminEnabled, readAdminSession } from "@/lib/admin-auth";

/**
 * Shared gate for every /api/admin/* route. Returns a NextResponse to send back
 * when the caller is not allowed (404 when the area is disabled — fail closed,
 * so its existence is not even disclosed; 401 when enabled but not authed), or
 * null when the request may proceed.
 */
export async function guardAdmin(): Promise<NextResponse | null> {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
