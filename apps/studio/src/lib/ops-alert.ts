import { sendEmail } from './email';

/**
 * Operational alerting: emails OPS_ALERT_EMAIL (falls back to logging when
 * unset). Used for events that need a human — stranded paid books, print
 * failures, GDPR requests. Never throws: an alert failure must not take down
 * the flow that raised it.
 */
export async function opsAlert(subject: string, detail: string): Promise<void> {
  console.error(`[ops-alert] ${subject}\n${detail}`);
  const to = process.env.OPS_ALERT_EMAIL;
  if (!to) return;
  try {
    await sendEmail({
      to,
      subject: `[WFSC ops] ${subject}`,
      html: `<pre style="font-family: monospace; white-space: pre-wrap;">${detail
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')}</pre>`,
    });
  } catch (err) {
    console.error('[ops-alert] failed to send alert email', err);
  }
}
