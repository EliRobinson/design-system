/* An anchored panel's inline min-width must be a floor, measured in a browser.
 *
 * #180 reported a DropdownMenu 95px wide against `.ds-dropdown__content`'s own
 * `min-width: 180px`. Both halves of that are cascade facts, and jsdom has no
 * cascade and no layout — the sibling assertions in DropdownMenu.test.tsx can
 * only see the declaration the positioner writes, never what it computes to.
 * This file measures the computed width of the real stylesheet under the real
 * geometry, which is the only place the bug was ever visible.
 *
 * The declarations below are the ones `useAnchoredPosition` writes, restated
 * here because a stylesheet fixture cannot run a React hook. That restatement
 * is what DropdownMenu.test.tsx pins from the other side: it asserts the hook
 * emits this exact shape, and this file asserts the shape does the right thing
 * in a browser. Change one and the other must move with it.
 *
 * Skipped, loudly, when no browser is available — the same contract as
 * select-intrinsic-width.mjs and packages/tokens' link-cascade tests. The bare
 * CI image has no browser and this must not be what blocks an unrelated change.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

/* Reached through the exports map rather than by walking up to packages/tokens,
   for the reason component-css.test.mjs gives: a hand-spelled path into that
   package is how a reader and the thing it reads come to disagree. */
import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';

const DROPDOWN_CSS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'components',
  'organisms',
  'DropdownMenu.css',
);

/* Same budget, and the same reason, as packages/tokens' browser tests. */
const BROWSER_BUDGET = 60_000;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = null;
}

let browser;
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

const describeBrowser = browser ? describe : describe.skip;
if (!browser) {
  console.warn(
    `Skipping anchored panel width tests: ${
      chromium ? launchError?.message : 'playwright is not installed'
    }`,
  );
}

/* The reported viewport, and an avatar-sized trigger in its top-right corner.
   1186 is the `left` the positioner wrote in the report; 1240 its right edge. */
const VIEWPORT = { width: 1280, height: 720 };
const TRIGGER = { width: 40, right: 1240, left: 1200 };

/* The width the report measured: what is left of the viewport beside a panel
   pinned at `left: 1186px`, which is all a shrink-to-fit fixed box can take. */
const CRUSHED_WIDTH = 95;

/* tokens.css @imports its siblings relatively, so it has to be fetched from a
   URL that has a directory -- setContent runs on about:blank, where
   `./palettes.css` resolves to nothing. Same arrangement as mobile-floor. */
const ORIGIN = 'https://anchored.test';

/** Render a menu panel with the given inline geometry and measure it. */
async function measure(inlineStyle) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'index.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <link rel="stylesheet" href="/tokens.css">
          <link rel="stylesheet" href="/DropdownMenu.css">
          <style>body { margin: 0 }</style>
          </head><body>
          <div id="panel" class="ds-dropdown__content" role="menu" style="${inlineStyle}">
            <div class="ds-dropdown__label">Account</div>
            <button type="button" class="ds-dropdown__item" role="menuitem">Account settings</button>
            <button type="button" class="ds-dropdown__item" role="menuitem">Sign out</button>
          </div>
          </body></html>`,
      });
    }

    if (name === 'DropdownMenu.css') {
      return route.fulfill({ contentType: 'text/css', body: readFileSync(DROPDOWN_CSS) });
    }

    const file = join(TOKENS_SRC_DIR, name);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
      body: readFileSync(file),
    });
  });

  await page.goto(`${ORIGIN}/index.html`);

  const measured = await page.evaluate(() => {
    const rect = document.getElementById('panel').getBoundingClientRect();
    return { width: Math.round(rect.width), right: Math.round(rect.right) };
  });

  await context.close();
  return measured;
}

/** The stylesheet's own floor, read from the sheet rather than restated here. */
const STYLESHEET_MIN_WIDTH = Number.parseInt(
  /--anchored-min-width:\s*(\d+)px/.exec(readFileSync(DROPDOWN_CSS, 'utf8'))?.[1] ?? 'NaN',
  10,
);

describeBrowser('an anchored menu panel is never narrower than its own minimum', () => {
  it('reads a floor out of the stylesheet to measure against', () => {
    // A rename that left this NaN would make every assertion below vacuous.
    expect(STYLESHEET_MIN_WIDTH).toBeGreaterThan(0);
  });

  /* Both assertions this fixture makes are only meaningful in the band between
     the crushed box and the stylesheet floor. Text wide enough to fill the
     floor on its own would make "the floor held" vacuous; text narrow enough
     to fit the crushed box would make "it was crushed" a measurement of the
     text rather than of the clamp. */
  it('has content sized between the crushed box and the floor', async () => {
    const { width } = await measure('position: fixed; top: 60px; left: 40px; min-width: 0');

    expect(width).toBeGreaterThan(CRUSHED_WIDTH);
    expect(width).toBeLessThan(STYLESHEET_MIN_WIDTH);
  });

  /* The positive control: the shipped-before declaration, at the reported
     geometry, reproducing the reported number. Without this the assertions
     below could pass on a fixture that was never capable of showing the bug. */
  it('is crushed when the inline min-width overrides the stylesheet', async () => {
    const { width } = await measure(
      `position: fixed; top: 60px; left: 1186px; min-width: ${TRIGGER.width}px`,
    );

    expect(width).toBeLessThan(STYLESHEET_MIN_WIDTH);
    expect(width).toBe(CRUSHED_WIDTH);
  });

  it('holds the stylesheet floor for a trigger narrower than it', async () => {
    const { width } = await measure(
      `position: fixed; top: 60px; right: ${VIEWPORT.width - TRIGGER.right}px; left: auto;` +
        ` min-width: max(var(--anchored-min-width, 0px), ${TRIGGER.width}px)`,
    );

    expect(width).toBeGreaterThanOrEqual(STYLESHEET_MIN_WIDTH);
  });

  it('still widens to a trigger wider than the floor', async () => {
    const wide = STYLESHEET_MIN_WIDTH + 220;
    const { width } = await measure(
      `position: fixed; top: 60px; left: 40px;` +
        ` min-width: max(var(--anchored-min-width, 0px), ${wide}px)`,
    );

    expect(width).toBeGreaterThanOrEqual(wide);
  });

  it('lands the panel right edge on the trigger right edge when aligned to the end', async () => {
    const { right } = await measure(
      `position: fixed; top: 60px; right: ${VIEWPORT.width - TRIGGER.right}px; left: auto;` +
        ` min-width: max(var(--anchored-min-width, 0px), ${TRIGGER.width}px)`,
    );

    expect(right).toBe(TRIGGER.right);
  });
});
