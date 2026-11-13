/* The browser bootstrap for this package's cascade and layout suites. Not a
 * published module: the `.test-helper.mjs` suffix matches neither Vitest's
 * include glob nor the package's `files`. It has the same contract as
 * packages/tokens/src/browser.test-helper.mjs, and adds component sheets. Every
 * browser suite in this folder boots through it.
 *
 * Why a real browser: jsdom has no layout and resolves a tie by source order
 * only, and the bugs these suites guard live in the cascade and the box tree.
 */

import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';
import { afterAll, describe } from 'vitest';

import { BROWSER_BUDGET, bootBrowser as bootShared } from '../../../tests/support/boot-browser.mjs';

/* The launch guard, the teardown budget and the reasoning behind both live in
   the repo's one shared bootstrap, tests/support/boot-browser.mjs (#402). */
export { BROWSER_BUDGET };

/* tokens.css @imports its siblings relatively, so it has to be fetched from a
   URL that has a directory: on about:blank, `./palettes.css` resolves to
   nothing. */
const ORIGIN = 'https://react.test';

/* Only what the routes serve: tokens' stylesheets and fonts. Anything else is
   sent as plain bytes. */
const CONTENT_TYPES = { '.css': 'text/css', '.woff2': 'font/woff2' };

/**
 * The shared bootstrap, bound to this package's own Vitest and Playwright.
 * Await it at a test file's top level.
 *
 * @param {string} label names the suite in the skip warning
 * @param {'chromium' | 'webkit' | 'firefox'} [engine] which browser to launch
 */
export function bootBrowser(label, engine = 'chromium') {
  return bootShared(label, {
    vitest: { afterAll, describe },
    playwright: () => import('playwright'),
    engine,
  });
}

/**
 * Open a page on `origin`, serving `html` at /index.html. Anything else is
 * looked up in `files` (published name -> file on disk), then in the tokens
 * source folder, so `/tokens.css` and its relative imports resolve. A path
 * found nowhere is a 404. Runs `run(page)` and closes the context, even when
 * `run` throws.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ origin?: string, html: string, files?: Record<string, string>, context?: import('playwright').BrowserContextOptions }} options
 * @param {(page: import('playwright').Page) => Promise<any>} run
 */
export async function openPage(browser, { origin = ORIGIN, html, files = {}, context = {} }, run) {
  /* A file the caller named must exist: a 404 here would quietly measure a
     page without its component sheet. Only the tokens folder falls back to 404. */
  for (const file of Object.values(files)) {
    if (!existsSync(file)) throw new Error(`browser test helper: missing file ${file}`);
  }

  const browserContext = await browser.newContext(context);
  try {
    const page = await browserContext.newPage();

    await page.route(`${origin}/**`, async (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);

      if (name === 'index.html') return route.fulfill({ contentType: 'text/html', body: html });

      const file = Object.hasOwn(files, name) ? files[name] : join(TOKENS_SRC_DIR, name);
      if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({
        contentType: CONTENT_TYPES[extname(name)] ?? 'application/octet-stream',
        body: readFileSync(file),
      });
    });

    await page.goto(`${origin}/index.html`);
    return await run(page);
  } finally {
    await browserContext.close();
  }
}

/**
 * `openPage` for the common shape: tokens.css, then each of `sheets` in order
 * (published name -> file on disk), then `head`, then `body`. Runs `probe` in
 * the page with `arg`.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ sheets?: Record<string, string>, head?: string, body: string, context?: import('playwright').BrowserContextOptions }} page
 * @param {(arg: any) => any} probe
 * @param {any} [arg]
 */
export async function inPage(browser, { sheets = {}, head = '', body, context }, probe, arg) {
  const links = Object.keys(sheets)
    .map((sheet) => `<link rel="stylesheet" href="/${sheet}">`)
    .join('');
  return openPage(
    browser,
    {
      html: `<!doctype html><html><head><meta charset="utf-8">
            <link rel="stylesheet" href="/tokens.css">${links}${head}
            </head><body>${body}</body></html>`,
      files: sheets,
      context,
    },
    (page) => page.evaluate(probe, arg),
  );
}
