import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagBool, flagStr } from '../lib/args.ts';
import { stateDir } from '../lib/paths.ts';
import { env } from '../lib/env.ts';
import {
  generationDelayedEmail,
  previewReadyEmail,
  printSubmittedEmail,
  reviewReadyEmail,
  sendEmail,
  type RenderedEmail,
} from '../../../../apps/studio/src/lib/email.ts';

/**
 * Render (and optionally send) all four customer emails with sample data so the
 * redesigned templates can be eyeballed end to end. With RESEND_API_KEY set and
 * a --to address it sends real mail via Resend; otherwise (or with --dry-run)
 * it writes each rendered .html + .txt to .wfsc-admin/email-preview/ so they can
 * be opened in a browser. --locale selects the copy table (defaults to en).
 */
async function run(args: ParsedArgs): Promise<void> {
  const to = flagStr(args, 'to');
  const locale = flagStr(args, 'locale', 'en');
  const hasKey = !!env('RESEND_API_KEY');
  // Dry-run is the default whenever there is no key; --dry-run forces it.
  const dryRun = flagBool(args, 'dry-run') || !hasKey;

  const sampleBook = {
    title: 'The Night Mila Met the Moon',
    access_token: 'sample-access-token-000000000000',
    locale,
  };

  const emails: { name: string; rendered: RenderedEmail }[] = [
    { name: 'preview-ready', rendered: previewReadyEmail(sampleBook) },
    { name: 'review-ready', rendered: reviewReadyEmail(sampleBook) },
    { name: 'print-submitted', rendered: printSubmittedEmail(sampleBook) },
    { name: 'generation-delayed', rendered: generationDelayedEmail(sampleBook) },
  ];

  if (dryRun) {
    if (!hasKey && !flagBool(args, 'dry-run')) {
      console.log('RESEND_API_KEY not set; running in dry-run mode.\n');
    }
    const outDir = join(stateDir, 'email-preview');
    mkdirSync(outDir, { recursive: true });
    for (const { name, rendered } of emails) {
      const htmlPath = join(outDir, `${name}.html`);
      const textPath = join(outDir, `${name}.txt`);
      writeFileSync(htmlPath, rendered.html, 'utf8');
      writeFileSync(textPath, rendered.text, 'utf8');
      console.log(`✓ ${name} (${locale})`);
      console.log(`    subject: ${rendered.subject}`);
      console.log(`    html:    ${htmlPath}`);
      console.log(`    text:    ${textPath}`);
    }
    console.log(`\nWrote ${emails.length} previews to ${outDir}`);
    console.log('Open the .html files in a browser (dark-mode spot check) and confirm each reads with images off.');
    return;
  }

  if (!to) {
    throw new Error('Sending requires --to <email>. Add --dry-run to write previews to disk instead.');
  }

  for (const { name, rendered } of emails) {
    await sendEmail({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
    console.log(`✓ sent ${name} (${locale}) to ${to}: ${rendered.subject}`);
  }
  console.log(`\nSent ${emails.length} test emails to ${to}.`);
}

export const sendTestEmails: Command = {
  name: 'send-test-emails',
  summary: 'Render (and optionally send) the four customer emails with sample data.',
  usage: 'send-test-emails [--to <email>] [--locale <en>] [--dry-run]',
  run,
};
