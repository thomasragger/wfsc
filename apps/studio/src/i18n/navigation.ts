import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation wrappers (LAUNCH-PLAN.md O11). Use these instead of
 * `next/link` / `next/navigation` for internal, localized pages so the active
 * locale prefix is preserved automatically. External links, `/api` fetches and
 * asset URLs keep using the plain primitives.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
