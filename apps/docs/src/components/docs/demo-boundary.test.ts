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
 * it boots through the repo's shared tests/support/boot-browser.mjs.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@elirobinson/react/components/organisms/Dialog';
import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BROWSER_BUDGET, bootBrowser } from '../../../../../tests/support/boot-browser.mjs';
import { SITE_CSS } from '../../lib/css-source';

const require = createRequire(import.meta.url);
const DIALOG_CSS = require.resolve('@elirobinson/react/styles/organisms/Dialog.css');

const { browser, describeBrowser } = await bootBrowser('demo boundary', {
  vitest: { afterAll, describe },
  playwright: () => import('playwright'),
});

const DIALOG = renderToStaticMarkup(
  h(Dialog, {
    defaultOpen: true,
    children: h(DialogContent, null, h(DialogHeader, null, h(DialogTitle, null, 'Rename'))),
  }),
);
const PLAIN =
  '<h2>Heading</h2><h3>Sub</h3><h4>Minor</h4><p>Paragraph <code>x</code></p>' +
  '<ul><li>Item</li></ul><ol><li>One</li></ol><hr><blockquote>Quote</blockquote>' +
  '<img alt="" width="2000" height="1">';
const PLAIN_TARGETS = [
  'h2:not([class])',
  'h3',
  'h4',
  'p',
  'code',
  'ul',
  'ol',
  'li',
  'hr',
  'blockquote',
  'img',
];
const TARGETS = ['.ds-dialog__title', ...PLAIN_TARGETS];
const PROPERTIES = [
  'font-size',
  'line-height',
  'margin-top',
  'margin-bottom',
  'padding-top',
  'padding-left',
  'border-top-width',
  'border-left-width',
  'background-color',
  'color',
  'list-style-type',
  'max-width',
];

const ORIGIN = 'https://demo-boundary.test';

type Styles = Record<string, Record<string, string> | null>;

async function measureBoundary(): Promise<{ bare: Styles; stage: Styles; prose: Styles }> {
  const context = await browser!.newContext();
  try {
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
    return result;
  } finally {
    await context.close();
  }
}

describeBrowser('a demo stage is a prose boundary', () => {
  let styles: Awaited<ReturnType<typeof measureBoundary>>;
  beforeAll(async () => {
    styles = await measureBoundary();
  }, BROWSER_BUDGET);

  it('prose restyles plain elements outside the stage (positive control)', () => {
    const { bare, prose } = styles;
    for (const selector of PLAIN_TARGETS) {
      expect(prose[selector], selector).not.toEqual(bare[selector]);
    }
  });

  it('nothing inside the stage is restyled by prose', () => {
    const { bare, stage } = styles;
    for (const selector of TARGETS) {
      expect(bare[selector], `${selector} rendered`).not.toBeNull();
      expect(stage[selector], selector).toEqual(bare[selector]);
    }
  });
});
