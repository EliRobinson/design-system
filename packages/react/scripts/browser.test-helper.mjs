/* The browser bootstrap for this package's cascade and layout suites. Not a
 * published module: the `.test-helper.mjs` suffix matches neither Vitest's
 * include glob nor the package's `files`. It is this package's copy of
 * packages/tokens/src/browser.test-helper.mjs, plus component sheets. #335
 * moves the package's other browser suites onto it.
 *
 * Why a real browser: jsdom has no layout and resolves a tie by source order
 * only, and the bugs these suites guard live in the cascade and the box tree.
 */

import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';
import { afterAll, describe } from 'vitest';

/* Same budget, and the same reason, as packages/tokens' browser tests. */
export const BROWSER_BUDGET = 60_000;

/* tokens.css @imports its siblings relatively, so it has to be fetched from a
   URL that has a directory: on about:blank, `./palettes.css` resolves to
   nothing. */
export const ORIGIN = 'https://react.test';

/**
 * Bring up a browser for the calling suite and register its teardown. Await it
 * at a test file's top level. `describeBrowser` is `describe.skip` when no
 * browser came up, so a bare CI image skips loudly rather than fails.
 *
 * @param {string} label names the suite in the skip warning
 * @param {'chromium' | 'webkit' | 'firefox'} [engine] which browser to launch
 */
export async function bootBrowser(label, engine = 'chromium') {
  let browserType = null;
  try {
    browserType = (await import('playwright'))[engine];
  } catch {
    browserType = null;
  }

  let browser = null;
  let launchError;
  if (browserType) {
    try {
      browser = await browserType.launch();
    } catch (error) {
      launchError = error;
    }
  }

  afterAll(async () => {
    await browser?.close();
  }, BROWSER_BUDGET);

  if (!browser) {
    console.warn(
      `Skipping ${label} tests: ${browserType ? launchError?.message : 'playwright is not installed'}`,
    );
  }

  return { browser, describeBrowser: browser ? describe : describe.skip };
}

/**
 * Open a page on ORIGIN that loads tokens.css, then each of `sheets` in order
 * (published name -> file on disk), then `head`, then `body`. Runs `probe` in
 * the page with `arg` and closes the context, even when the probe throws.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ sheets?: Record<string, string>, head?: string, body: string, viewport?: { width: number, height: number } }} page
 * @param {(arg: any) => any} probe
 * @param {any} [arg]
 */
export async function inPage(browser, { sheets = {}, head = '', body, viewport }, probe, arg) {
  const context = await browser.newContext(viewport ? { viewport } : {});
  try {
    const page = await context.newPage();

    await page.route(`${ORIGIN}/**`, async (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);

      if (name === 'index.html') {
        const links = Object.keys(sheets)
          .map((sheet) => `<link rel="stylesheet" href="/${sheet}">`)
          .join('');
        return route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html><head><meta charset="utf-8">
            <link rel="stylesheet" href="/tokens.css">${links}${head}
            </head><body>${body}</body></html>`,
        });
      }

      if (sheets[name]) {
        return route.fulfill({ contentType: 'text/css', body: readFileSync(sheets[name]) });
      }

      const file = join(TOKENS_SRC_DIR, name);
      if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({
        contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
        body: readFileSync(file),
      });
    });

    await page.goto(`${ORIGIN}/index.html`);
    return await page.evaluate(probe, arg);
  } finally {
    await context.close();
  }
}
