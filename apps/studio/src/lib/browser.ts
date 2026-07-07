import type { BrowserLike } from '@wfsc/book-engine/pdf';

/**
 * Launch headless Chromium for PDF rendering:
 * - On Vercel/serverless: @sparticuz/chromium binary
 * - Locally: system Chrome (CHROME_PATH overridable)
 */
export async function launchBrowser(): Promise<BrowserLike & { close(): Promise<void> }> {
  const puppeteer = await import('puppeteer-core');
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return (await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })) as unknown as BrowserLike & { close(): Promise<void> };
  }
  const executablePath =
    process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return (await puppeteer.launch({ executablePath, headless: true })) as unknown as BrowserLike & {
    close(): Promise<void>;
  };
}
