import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

export const runtime = "nodejs";

/** POST /api/locale — explicit language choice; wins over geo detection. */
export async function POST(request: Request) {
  const { locale } = (await request.json().catch(() => ({}))) as { locale?: string };
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }
  (await cookies()).set(LOCALE_COOKIE, locale, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true, locale });
}
