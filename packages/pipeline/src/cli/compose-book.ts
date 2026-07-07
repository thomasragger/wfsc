/**
 * Compose-only harness: re-render the PDF from an existing generated book.json
 * without touching any generation APIs. Fast layout-iteration loop.
 *
 * Usage: pnpm --filter @wfsc/pipeline exec tsx src/cli/compose-book.ts <dir-with-book.json>
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { BookData } from '@wfsc/book-engine';
import { renderInteriorPdf } from '@wfsc/book-engine/pdf';

const [dirArg] = process.argv.slice(2);
if (!dirArg) {
  console.error('Usage: tsx src/cli/compose-book.ts <dir-with-book.json>');
  process.exit(1);
}
const dir = resolve(dirArg);
const book = JSON.parse(await readFile(join(dir, 'book.json'), 'utf8')) as BookData;

const puppeteer = await import('puppeteer-core');
const executablePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const pdf = await renderInteriorPdf(browser, book);
  await writeFile(join(dir, 'book-interior.pdf'), pdf);
  console.log(`✓ Re-rendered → ${join(dir, 'book-interior.pdf')}`);
} finally {
  await browser.close();
}
