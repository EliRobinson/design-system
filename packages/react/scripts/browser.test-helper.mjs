/* The browser bootstrap for this package's cascade and layout suites. Not a
 * published module: the `.test-helper.mjs` suffix matches neither Vitest's
 * include glob nor the package's `files`. It has the same contract as
 * packages/tokens/src/browser.test-helper.mjs, and adds component sheets. Every
 * browser suite in this folder boots through it. The launch guard, the
 * teardown budget and the reasoning behind both live in the repo's one shared
 * bootstrap, tests/support/boot-browser.mjs (#402).
 *
 * Why a real browser: jsdom has no layout and resolves a tie by source order
 * only, and the bugs these suites guard live in the cascade and the box tree.
 */

import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';
import { afterAll, describe } from 'vitest';

import { BROWSER_BUDGET, bootBrowser as bootShared } from '../../../tests/support/boot-browser.mjs';
import { openPage } from '../../../tests/support/open-page.mjs';

export { BROWSER_BUDGET };

/* Why a synthetic origin: see tests/support/open-page.mjs. */
const ORIGIN = 'https://react.test';

/**
 * The shared bootstrap, bound to this package's own Vitest and Playwright.
 * Await it at a test file's top level.
 *
 * @param {string} label names the suite in the skip warning
 * @param {import('../../../tests/support/boot-browser.mjs').Engine} [engine] which browser to launch
 */
export function bootBrowser(label, engine = 'chromium') {
  return bootShared(label, {
    vitest: { afterAll, describe },
    playwright: () => import('playwright'),
    engine,
  });
}

/**
 * Open a page through the shared page server (tests/support/open-page.mjs,
 * #419) with the common shape: tokens.css, then each of `sheets` in order
 * (published name -> file on disk, each one must exist), then `head`, then
 * `body`. Any other path is read from the tokens source folder, so tokens.css's
 * relative imports resolve. Runs `act(page)` first when given (a hover, say),
 * then `probe` in the page with `arg`.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ sheets?: Record<string, string>, head?: string, body: string, context?: import('playwright').BrowserContextOptions, act?: (page: import('playwright').Page) => Promise<unknown> }} page
 * @param {(arg: any) => any} probe
 * @param {any} [arg]
 */
export async function inPage(browser, { sheets = {}, head = '', body, context, act }, probe, arg) {
  const links = Object.keys(sheets)
    .map((sheet) => `<link rel="stylesheet" href="/${sheet}">`)
    .join('');
  return openPage(
    browser,
    {
      origin: ORIGIN,
      html: `<!doctype html><html><head><meta charset="utf-8">
            <link rel="stylesheet" href="/tokens.css">${links}${head}
            </head><body>${body}</body></html>`,
      files: sheets,
      fallbackDir: TOKENS_SRC_DIR,
      context,
    },
    async (page) => {
      if (act) await act(page);
      return page.evaluate(probe, arg);
    },
  );
}
