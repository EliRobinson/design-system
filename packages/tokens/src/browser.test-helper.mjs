/* The browser bootstrap shared by this package's cascade suites
 * (link-cascade, form-font-cascade, mobile-floor, type-cascade). Not a
 * published module: the `.test-helper.mjs` suffix matches neither Vitest's
 * include glob nor the package's `files`, so it is neither collected as a suite
 * nor shipped. The launch, its guard, the teardown budget and the reasoning
 * behind them live in the repo's one shared bootstrap,
 * tests/support/boot-browser.mjs (#402); this file adds the tokens page.
 *
 * Why these suites need a real browser at all: cascade layers are decided by
 * layer ORDER, which is fixed by first declaration across every stylesheet in
 * the document, and jsdom does not model layers.
 */

import { afterAll, describe } from 'vitest';

import { BROWSER_BUDGET, bootBrowser as bootShared } from '../../../tests/support/boot-browser.mjs';
import { openPage } from '../../../tests/support/open-page.mjs';

import { TOKENS_SRC_DIR } from './token-stylesheets.mjs';

export { BROWSER_BUDGET };

/* A synthetic origin, served from src/. Why: see tests/support/open-page.mjs. */
const ORIGIN = 'https://tokens.test';

/* The layer order `@import 'tailwindcss'` declares ahead of tokens.css. It is
   what makes tokens.css's `base` sort below `utilities`, so every suite that
   stands in for a Tailwind consumer starts with it. */
export const TAILWIND_LAYER_ORDER = '@layer theme, base, components, utilities;';

/**
 * The shared bootstrap, bound to this package's own Vitest and Playwright.
 * Await it at a test file's top level.
 *
 * @param {string} label names the suite in the skip warning
 */
export function bootBrowser(label) {
  return bootShared(label, {
    vitest: { afterAll, describe },
    playwright: () => import('playwright'),
  });
}

/**
 * Open a page on ORIGIN that serves `html` as its index and reads every other
 * path from this package's src/ (tokens.css, its siblings, the fonts). Runs
 * `run(page)` and closes the context, even when `run` throws. The route lives
 * in the repo's one shared page server, tests/support/open-page.mjs (#419).
 *
 * @template T
 * @param {import('playwright').Browser} browser
 * @param {{ html: string, context?: import('playwright').BrowserContextOptions }} options
 * @param {(page: import('playwright').Page) => Promise<T>} run
 * @returns {Promise<T>}
 */
export function openTokensPage(browser, { html, context }, run) {
  return openPage(browser, { origin: ORIGIN, html, fallbackDir: TOKENS_SRC_DIR, context }, run);
}

/**
 * A consumer page: `before` stylesheets, then the real tokens.css, then
 * `after` (raw markup, such as a component `<style>`), then `body`. Runs
 * `run(page)` on it, as openTokensPage does.
 *
 * @template T
 * @param {import('playwright').Browser} browser
 * @param {{ htmlAttributes?: string, before?: string[], after?: string, body: string }} options
 * @param {(page: import('playwright').Page) => Promise<T>} run
 * @returns {Promise<T>}
 */
export function consumerPage(browser, { htmlAttributes = '', before = [], after = '', body }, run) {
  return openTokensPage(
    browser,
    {
      html: `<!doctype html><html ${htmlAttributes}><meta charset="utf-8">
      ${before.map((css) => `<style>${css}</style>`).join('\n')}
      <link rel="stylesheet" href="/tokens.css">
      ${after}
      ${body}`,
    },
    run,
  );
}
