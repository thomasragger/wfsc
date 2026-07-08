import { NextResponse } from "next/server";

import { fetchSamples } from "@/lib/samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/samples — public gallery of sample books (books.is_sample = true).
 * Degrades to an empty list if the column / data isn't there yet.
 */
export async function GET() {
  const samples = await fetchSamples();
  return NextResponse.json({ samples });
}
