/**
 * Lulu Print API client (sandbox-first).
 * Docs: https://api.lulu.com/docs/ — OAuth2 client-credentials, print jobs take
 * publicly downloadable PDF source URLs.
 *
 * SKU (new dotted format, live since 03/2026; legacy format dies 02/2027):
 *   0850X0850.FC.PRE.CW.080CW444.MXX  = 8.5×8.5in, full premium color, casewrap, 80# coated white
 */
const SKUS = {
  hardcover: process.env.LULU_SKU_HARDCOVER ?? '0850X0850.FC.PRE.CW.080CW444.MXX',
  softcover: process.env.LULU_SKU_SOFTCOVER ?? '0850X0850.FC.PRE.PB.080CW444.MXX',
} as const;

function baseUrl(): string {
  return process.env.LULU_ENV === 'production'
    ? 'https://api.lulu.com'
    : 'https://api.sandbox.lulu.com';
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  const key = process.env.LULU_CLIENT_KEY;
  const secret = process.env.LULU_CLIENT_SECRET;
  if (!key || !secret) throw new Error('LULU_CLIENT_KEY / LULU_CLIENT_SECRET not configured');
  const res = await fetch(`${baseUrl()}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: key,
      client_secret: secret,
    }),
  });
  if (!res.ok) throw new Error(`Lulu auth failed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`Lulu ${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export interface LuluCoverDimensions {
  width: string; // points
  height: string;
  unit: string;
}

/**
 * Derive the spine width from Lulu's cover dimensions. The wraparound canvas
 * adds the same wrap+bleed margin on every edge, so:
 *   extraPerEdge = (height - trimHeight) / 2
 *   spine = width - 2*trimWidth - 2*extraPerEdge
 * (verified against the 8.5×8.5in casewrap: 1368×738pt @ 32pp → 18pt spine)
 */
export function spineFromCoverDimensions(dims: LuluCoverDimensions, trimPt = 612): number {
  const width = Number(dims.width);
  const height = Number(dims.height);
  const extraPerEdge = (height - trimPt) / 2;
  return width - 2 * trimPt - 2 * extraPerEdge;
}

/** Exact wraparound cover dimensions for SKU + page count (drives the cover PDF). */
export async function coverDimensions(
  format: keyof typeof SKUS,
  pageCount: number,
): Promise<LuluCoverDimensions> {
  return api<LuluCoverDimensions>('/cover-dimensions/', {
    method: 'POST',
    body: JSON.stringify({ pod_package_id: SKUS[format], interior_page_count: pageCount }),
  });
}

export interface LuluAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  postcode: string;
  country_code: string; // ISO 3166-1 alpha-2
  state_code?: string;
  phone_number?: string;
  email?: string;
}

export interface LuluPrintJob {
  id: number;
  status: { name: string };
  line_items: {
    id: number;
    status?: { name: string; messages?: unknown };
    tracking_id?: string | null;
    tracking_urls?: string[] | null;
  }[];
}

/** Submit a print job: interior + cover PDF URLs must be publicly downloadable. */
export async function createPrintJob(opts: {
  externalId: string; // our book id
  format: keyof typeof SKUS;
  pageCount: number;
  title: string;
  interiorPdfUrl: string;
  coverPdfUrl: string;
  shippingAddress: LuluAddress;
  shippingLevel?: 'MAIL' | 'GROUND' | 'EXPEDITED' | 'EXPRESS';
}): Promise<LuluPrintJob> {
  return api<LuluPrintJob>('/print-jobs/', {
    method: 'POST',
    body: JSON.stringify({
      external_id: opts.externalId,
      contact_email: process.env.LULU_CONTACT_EMAIL ?? opts.shippingAddress.email,
      line_items: [
        {
          external_id: opts.externalId,
          title: opts.title,
          quantity: 1,
          printable_normalization: {
            pod_package_id: SKUS[opts.format],
            interior: { source_url: opts.interiorPdfUrl },
            cover: { source_url: opts.coverPdfUrl },
          },
        },
      ],
      shipping_address: opts.shippingAddress,
      shipping_level: opts.shippingLevel ?? 'MAIL',
    }),
  });
}

export async function getPrintJob(id: number): Promise<LuluPrintJob> {
  return api<LuluPrintJob>(`/print-jobs/${id}/`);
}

/**
 * Cancel a print job (only possible before it enters production — Lulu
 * rejects later cancellations; callers must alert ops on failure).
 */
export async function cancelPrintJob(id: number): Promise<void> {
  await api(`/print-jobs/${id}/status/`, {
    method: 'PUT',
    body: JSON.stringify({ name: 'CANCELED' }),
  });
}
