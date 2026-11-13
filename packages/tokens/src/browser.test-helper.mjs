/* The browser bootstrap shared by this package's cascade suites
 * (link-cascade, form-font-cascade, mobile-floor, type-cascade). Not a
 * published module: the `.test-helper.mjs` suffix matches neither Vitest's
 * include glob nor the package's `files`, so it is neither collected as a suite
 * nor shipped. The launch itself is the repo's one shared bootstrap,
 * tests/support/boot-browser.mjs; this file adds the tokens page.
 *
 * Why these suites need a real browser at all: cascade layers are decided by
 * layer ORDER, which is fixed by first declaration across every stylesheet in
 * the document, and jsdom does not model layers.
 */

import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { afterAll, describe } from 'vitest';

import { BROWSER_BUDGET, bootBrowser as bootShared } from '../../../tests/support/boot-browser.mjs';

import { TOKENS_SRC_DIR } from './token-stylesheets.mjs';

/* The launch guard, the teardown budget and the reasoning behind both live in
   the repo's one shared bootstrap, tests/support/boot-browser.mjs (#402). */
export { BROWSER_BUDGET };

/* A synthetic origin, served from src/ by a route handler. tokens.css @imports
   its siblings relatively, so it has to be fetched from a URL that has a
   directory — `setContent` runs on about:blank, where `./palettes.css` resolves
   to nothing and the whole palette would silently be missing. */
export const ORIGIN = 'https://tokens.test';

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
 * Serve `html` as the index of ORIGIN on `page`, with every other path read
 * from this package's src/ (tokens.css, its siblings, the fonts), and load it.
 *
 * @param {import('playwright').Page} page
 * @param {string} html
 */
export async function openTokensPage(page, html) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'index.html') {
      return route.fulfill({ contentType: 'text/html', body: html });
    }

    const file = join(TOKENS_SRC_DIR, name);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
      body: readFileSync(file),
    });
  });

  await page.goto(`${ORIGIN}/index.html`);
  return page;
}

/**
 * A consumer page: `before` stylesheets, then the real tokens.css, then
 * `after` (raw markup, such as a component `<style>`), then `body`. Opens a new
 * page on `browser` and returns it loaded.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ htmlAttributes?: string, before?: string[], after?: string, body: string }} options
 */
export async function consumerPage(
  browser,
  { htmlAttributes = '', before = [], after = '', body },
) {
  const page = await browser.newPage();
  return openTokensPage(
    page,
    `<!doctype html><html ${htmlAttributes}><meta charset="utf-8">
      ${before.map((css) => `<style>${css}</style>`).join('\n')}
      <link rel="stylesheet" href="/tokens.css">
      ${after}
      ${body}`,
  );
}
