/* The docs' prose rules stop at a demo's stage (#367).
 *
 * site.css styles headings, paragraphs and lists inside `.prose`, and every
 * demo sits inside `.prose`. DemoBlock marks its stage `not-prose`, and each
 * prose rule skips that subtree. This loads the real site.css after the real
 * component sheet, mounts a Dialog and plain elements inside
 * `.prose > .demo-block__stage.not-prose`, and asserts they compute the same
 * as they do outside prose. A positive control proves the prose rules do apply
 * one level up, so a pass is the boundary holding, not the sheet missing.
 *
 * Needs a real cascade, so it runs in a browser, and skips loudly without one:
 * the same contract as the browser tests in packages/react/scripts.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@elirobinson/react/components/organisms/Dialog';
import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const SITE_CSS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'site.css');
const DIALOG_CSS = require.resolve('@elirobinson/react/styles/organisms/Dialog.css');

let chromium: typeof import('playwright').chromium | null;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = null;
}

let browser: import('playwright').Browser | undefined;
let launchError: unknown;
if (chromium) {
  try {
    browser = await chromium.launch();
  } catch (error) {
    launchError = error;
  }
}

afterAll(async () => {
  await browser?.close();
}, 60_000);

const describeBrowser = browser ? describe : describe.skip;
if (!browser) {
  console.warn(
    `Skipping demo boundary tests: ${
      chromium ? (launchError as Error)?.message : 'playwright is not installed'
    }`,
  );
}

const DIALOG = renderToStaticMarkup(
  h(
    Dialog,
    { defaultOpen: true },
    h(DialogContent, null, h(DialogHeader, null, h(DialogTitle, null, 'Rename'))),
  ),
);
const PLAIN = '<h2>Heading</h2><p>Paragraph</p><ul><li>Item</li></ul>';
const TARGETS = ['.ds-dialog__title', 'h2:not([class])', 'p', 'ul', 'li'];
const PROPERTIES = [
  'font-size',
  'line-height',
  'margin-top',
  'margin-bottom',
  'padding-top',
  'border-top-width',
  'list-style-type',
];

const ORIGIN = 'https://demo-boundary.test';

type Styles = Record<string, Record<string, string> | null>;

async function computed(): Promise<{ bare: Styles; stage: Styles; prose: Styles }> {
  const context = await browser!.newContext();
  const page = await context.newPage();

  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (name === 'index.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <link rel="stylesheet" href="/tokens.css">
          <link rel="stylesheet" href="/Dialog.css">
          <link rel="stylesheet" href="/site.css">
          </head><body>
          <div id="bare">${DIALOG}${PLAIN}</div>
          <article class="prose">
            <div id="prose">${PLAIN}</div>
            <div class="demo-block__stage not-prose" id="stage">${DIALOG}${PLAIN}</div>
          </article>
          </body></html>`,
      });
    }
    if (name === 'Dialog.css') {
      return route.fulfill({ contentType: 'text/css', body: readFileSync(DIALOG_CSS) });
    }
    if (name === 'site.css') {
      return route.fulfill({ contentType: 'text/css', body: readFileSync(SITE_CSS) });
    }
    const file = join(TOKENS_SRC_DIR, name);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
      body: readFileSync(file),
    });
  });

  await page.goto(`${ORIGIN}/index.html`);
  const result = await page.evaluate(
    ({ targets, properties }) => {
      const read = (id: string) =>
        Object.fromEntries(
          targets.map((selector) => {
            const element = document.getElementById(id)!.querySelector(selector);
            if (!element) return [selector, null];
            const style = getComputedStyle(element);
            return [
              selector,
              Object.fromEntries(properties.map((p) => [p, style.getPropertyValue(p)])),
            ];
          }),
        );
      return { bare: read('bare'), stage: read('stage'), prose: read('prose') };
    },
    { targets: TARGETS, properties: PROPERTIES },
  );
  await context.close();
  return result;
}

describeBrowser('a demo stage is a prose boundary', () => {
  it('prose restyles plain elements outside the stage (positive control)', async () => {
    const { bare, prose } = await computed();
    for (const selector of ['h2:not([class])', 'p', 'ul', 'li']) {
      expect(prose[selector], selector).not.toEqual(bare[selector]);
    }
  });

  it('nothing inside the stage is restyled by prose', async () => {
    const { bare, stage } = await computed();
    for (const selector of TARGETS) {
      expect(bare[selector], `${selector} rendered`).not.toBeNull();
      expect(stage[selector], selector).toEqual(bare[selector]);
    }
  });
});
