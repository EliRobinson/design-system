/* The one page server for every browser suite in this repo that loads real
 * stylesheets: packages/tokens, packages/react/scripts and apps/docs (#419).
 * Each kept its own route handler, and the copies drifted: only react's closed
 * its context when the probe threw, and only react refused a missing file.
 *
 * Not published, for the same reason as boot-browser.mjs beside it. Nx sees it
 * through the same `browserSupport` input.
 *
 * It imports no package. The caller passes the fallback folder in, so this file
 * does not have to resolve `@elirobinson/tokens` from the repo root.
 */

import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

/* Only what the routes serve: stylesheets and fonts. Anything else is sent as
   plain bytes. */
const CONTENT_TYPES = { '.css': 'text/css', '.woff2': 'font/woff2' };

/**
 * Open a page on `origin`, serving `html` at /index.html. Any other path is
 * looked up in `files` (published name -> file on disk), then in `fallbackDir`.
 * A path found nowhere is a 404. Runs `run(page)` and closes the context, even
 * when `run` throws.
 *
 * A synthetic origin, not `setContent`: tokens.css @imports its siblings
 * relatively, so it has to be fetched from a URL that has a directory. On
 * about:blank, `./palettes.css` resolves to nothing and the palette is silently
 * missing.
 *
 * The types are in open-page.d.mts.
 */
export async function openPage(
  browser,
  { origin, html, files = {}, fallbackDir, context = {} },
  run,
) {
  /* A file the caller named must exist: a 404 here would quietly measure a
     page without its sheet. Only the fallback folder falls back to 404. */
  for (const file of Object.values(files)) {
    if (!existsSync(file)) throw new Error(`openPage: missing file ${file}`);
  }

  const browserContext = await browser.newContext(context);
  try {
    const page = await browserContext.newPage();

    await page.route(`${origin}/**`, async (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);

      if (name === 'index.html') return route.fulfill({ contentType: 'text/html', body: html });

      const file = Object.hasOwn(files, name) ? files[name] : join(fallbackDir, name);
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
