/**
 * Register the Lulu PRINT_JOB_STATUS_CHANGED webhook (idempotent).
 * Run: node --env-file=.env scripts/lulu-setup.mjs [webhook-url]
 * Default webhook URL: https://wfsc-studio.vercel.app/api/webhooks/lulu
 */
const base = process.env.LULU_ENV === 'production' ? 'https://api.lulu.com' : 'https://api.sandbox.lulu.com';
const targetUrl = process.argv[2] ?? `${process.env.STUDIO_URL ?? 'https://wfsc-studio.vercel.app'}/api/webhooks/lulu`;

const tokenRes = await fetch(`${base}/auth/realms/glasstree/protocol/openid-connect/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.LULU_CLIENT_KEY,
    client_secret: process.env.LULU_CLIENT_SECRET,
  }),
});
if (!tokenRes.ok) { console.error(`Lulu auth failed: ${tokenRes.status}`); process.exit(1); }
const { access_token } = await tokenRes.json();
const H = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

const existing = await (await fetch(`${base}/webhooks/`, { headers: H })).json();
const hooks = existing.results ?? existing;
const match = Array.isArray(hooks) && hooks.find((h) => h.url === targetUrl);
if (match) {
  console.log(`✓ Webhook already registered (id ${match.id}, active=${match.is_active})`);
} else {
  const res = await fetch(`${base}/webhooks/`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ topics: ['PRINT_JOB_STATUS_CHANGED'], url: targetUrl }),
  });
  if (!res.ok) { console.error(`Webhook create failed ${res.status}: ${await res.text()}`); process.exit(1); }
  const created = await res.json();
  console.log(`✓ Webhook registered (id ${created.id}) → ${targetUrl}`);
}
console.log(`Environment: ${process.env.LULU_ENV ?? 'sandbox'} (${base})`);
