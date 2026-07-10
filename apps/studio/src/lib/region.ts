import { headers } from "next/headers";

/** Site regions we tailor location templates to. */
export type Region = "dach" | "us";

const COUNTRY_TO_REGION: Record<string, Region> = {
  DE: "dach",
  AT: "dach",
  CH: "dach",
  LI: "dach",
  US: "us",
};

/**
 * Best-effort visitor region from the edge geo header Vercel sets
 * (`x-vercel-ip-country`). An explicit override (e.g. a ?region= query param
 * the visitor toggled) always wins. Falls back to 'dach' when unknown, since
 * that's our launch market.
 */
export async function detectRegion(override?: string | null): Promise<Region> {
  if (override === "dach" || override === "us") return override;
  try {
    const country = (await headers()).get("x-vercel-ip-country")?.toUpperCase();
    if (country && COUNTRY_TO_REGION[country]) return COUNTRY_TO_REGION[country];
  } catch {
    // headers() unavailable (e.g. static context) — fall through
  }
  return "dach";
}

export const REGION_LABELS: Record<Region, string> = {
  dach: "Germany, Austria & Switzerland",
  us: "United States",
};
