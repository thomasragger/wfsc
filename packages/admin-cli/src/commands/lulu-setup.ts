import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { requireEnv, env } from '../lib/env.ts';

async function run(args: ParsedArgs): Promise<void> {
  requireEnv('LULU_CLIENT_KEY', 'LULU_CLIENT_SECRET');
  const base = env('LULU_ENV') === 'production' ? 'https://api.lulu.com' : 'https://api.sandbox.lulu.com';

  const arg = args.positionals[0];
  let targetUrl = arg;
  if (!targetUrl) {
    requireEnv('STUDIO_URL');
    targetUrl = `${(env('STUDIO_URL') as string).replace(/\/$/, '')}/api/webhooks/lulu`;
  }

  const tokenRes = await fetch(`${base}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env('LULU_CLIENT_KEY') as string,
      client_secret: env('LULU_CLIENT_SECRET') as string,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Lulu auth failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const H = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

  const existing = (await (await fetch(`${base}/webhooks/`, { headers: H })).json()) as {
    results?: { id: string; url: string; is_active: boolean }[];
  };
  const hooks = existing.results ?? [];
  const match = Array.isArray(hooks) && hooks.find((h) => h.url === targetUrl);
  if (match) {
    console.log(`✓ Webhook already registered (id ${match.id}, active=${match.is_active})`);
  } else {
    const res = await fetch(`${base}/webhooks/`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ topics: ['PRINT_JOB_STATUS_CHANGED'], url: targetUrl }),
    });
    if (!res.ok) throw new Error(`Webhook create failed ${res.status}: ${await res.text()}`);
    const created = (await res.json()) as { id: string };
    console.log(`✓ Webhook registered (id ${created.id}) -> ${targetUrl}`);
  }
  console.log(`Environment: ${env('LULU_ENV') ?? 'sandbox'} (${base})`);
}

export const luluSetup: Command = {
  name: 'lulu-setup',
  summary: 'Register the Lulu PRINT_JOB_STATUS_CHANGED webhook (idempotent).',
  usage: 'lulu-setup [webhook-url]  (defaults to STUDIO_URL/api/webhooks/lulu)',
  run,
};
