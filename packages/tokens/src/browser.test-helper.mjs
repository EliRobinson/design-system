/* The browser bootstrap shared by this package's cascade suites
 * (link-cascade, form-font-cascade, mobile-floor, type-cascade). Not a
 * published module: the `.test-helper.mjs` suffix matches neither Vitest's
 * include glob nor the package's `files`, so it is neither collected as a suite
 * nor shipped. @elirobinson/ai-patterns keeps its own copy of the same idea in
 * src/testing/browser.test-helper.mjs; this package does not depend on that one.
 *
 * Why these suites need a real browser at all: cascade layers are decided by
 * layer ORDER, which is fixed by first declaration across every stylesheet in
 * the document, and jsdom does not model layers.
 */

import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { afterAll, describe } from 'vitest';

import { TOKENS_SRC_DIR } from './token-stylesheets.mjs';

/* Launching, opening and closing Chromium share the machine with whatever else
   the monorepo is running, and Vitest's 10s hook default is sized for a unit
   test's setup. The measured reasoning is in @elirobinson/ai-patterns'
   src/testing/browser.test-helper.mjs. */
export const BROWSER_BUDGET = 60_000;

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
 * Bring up a browser for the calling suite, register its teardown, and hand
 * back the `describe` to hang the browser-dependent cases off.
 *
 * Await it at a test file's top level, where Vitest is still collecting and
 * `afterAll` binds to that file. `describeBrowser` is `describe.skip` when no
 * browser came up, so a bare CI image skips loudly rather than fails.
 *
 * @param {string} label names the suite in the skip warning
 */
export async function bootBrowser(label) {
  let chromium = null;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    chromium = null;
  }

  let browser = null;
  let launchError;
  if (chromium) {
    try {
      browser = await chromium.launch();
    } catch (error) {
      launchError = error;
    }
  }

  afterAll(async () => {
    await browser?.close();
  }, BROWSER_BUDGET);

  if (!browser) {
    console.warn(
      `Skipping ${label} tests: ${chromium ? launchError?.message : 'playwright is not installed'}`,
    );
  }

  return { browser, describeBrowser: browser ? describe : describe.skip };
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
