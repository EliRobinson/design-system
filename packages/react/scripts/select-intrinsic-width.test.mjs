/* A <select>'s option text must never reach the document, measured in WebKit.
 *
 * A native <select>'s preferred width is its widest <option>. In WebKit that
 * width escapes the control: the <select>'s own box still obeys width:100% and
 * the <option> boxes measure 0x0, yet documentElement.scrollWidth grows and the
 * whole page scrolls sideways. Chromium's UA stylesheet computes
 * `overflow: clip` on a <select> and is immune; WebKit computes `visible`. iOS
 * runs WebKit exclusively, so this is the shape of bug that is invisible in a
 * desktop browser, invisible in Chrome devtools' device emulation, and
 * invisible to any Chromium project at a phone viewport -- which is how it
 * survived in a consuming repo with a full e2e suite (#173).
 *
 * ENGINE, not viewport, is what this file is about. Running it in Chromium
 * would pass green against the exact defect it exists to catch, so it launches
 * webkit specifically and skips -- loudly -- rather than silently falling back.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE TRUSTING A GREEN RUN. This guard does not reproduce the
 * reported bug in its reported shape, and the gap is not yet explained.
 *
 * In the consumer (house-warm, /app/open-houses/new, Mobile Safari at 350x740,
 * production build, a 58-character address) the document measures 439/350 with
 * `overflow: hidden` removed, while the <select> itself is 310px -- width:100%
 * obeyed, class list the shipped `ds-input ds-select`, no consumer width
 * override, .ds-field still `display: grid`. The only differing computed value
 * is overflow-x.
 *
 * This fixture does NOT show that. Rendering the same markup and the same two
 * stylesheets over a routed origin measures 350/350 either way, and so does
 * every ancestor chain tried: plain block, flex row, flex column, and the
 * consumer's own grid-inside-flex-item-inside-column-flex-shell -- that last
 * one was the leading hypothesis for the difference and it is disproven. Also
 * ruled out: viewport (350 and 390), device emulation (isMobile/hasTouch and
 * the iPhone descriptor), option length (57, 58 and 122 characters), and
 * engine build -- Playwright's webkit, macOS Safari 26.5.2 and iOS Safari 26.2
 * in the Simulator all agree with each other and disagree with the consumer.
 *
 * The untested candidate, left untested because this repo does not install
 * Tailwind, is the consumer's Tailwind v4 preflight and the cascade layers it
 * introduces ahead of the component sheet. Anything else the consumer has that
 * this fixture lacks -- a production bundler, an app shell, a real route -- is
 * equally unexcluded.
 *
 * So what the assertions below actually pin is a PROXY: `width: 100%` is
 * deliberately defeated, which does make this fixture leak in WebKit, and the
 * declaration must close it. That proxy was chosen because it is the only
 * lever found that reproduces a leak here at all -- it is NOT the mechanism
 * observed in the consumer, where the width is obeyed and the leak happens
 * anyway. Do not read a green run as "the reported bug cannot come back". Read
 * it as "the declaration is present and still does what it does". If you find
 * the fixture difference, replace the proxy with the real shape and delete
 * this block.
 * ---------------------------------------------------------------------------
 *
 * The control is deliberately inside .ds-field, which is `display: grid`,
 * matching the consumer. Skipped, loudly, when no browser is available -- the
 * same contract as packages/tokens' link-cascade and mobile-floor tests. The
 * bare CI image has no WebKit and this must not be what blocks an unrelated
 * change.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

/* Reached through the exports map rather than by walking up to packages/tokens,
   for the reason component-css.test.mjs gives: a hand-spelled path into that
   package is how a reader and the thing it reads come to disagree. */
import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';

const FIELD_CSS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'components',
  'atoms',
  'field.css',
);

/* Same budget, and the same reason, as packages/tokens' browser tests. */
const BROWSER_BUDGET = 60_000;

let webkit;
try {
  ({ webkit } = await import('playwright'));
} catch {
  webkit = null;
}

let browser;
let launchError;
if (webkit) {
  try {
    browser = await webkit.launch();
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
    `Skipping <select> intrinsic-width tests: ${
      webkit ? launchError?.message : 'playwright is not installed'
    }`,
  );
}

/* A phone-shaped viewport, and an option far wider than it. The string is
   address-shaped because that is what the reporting consumer had in there:
   option text is user data, so no copy discipline bounds its width. */
const VIEWPORT = { width: 350, height: 740 };
const LONG_OPTION =
  '1247 Northwest Kensington Boulevard, Apartment 14B, Seattle, Washington 98117 — attention Katherine Vandermeer-Rodriguez';

/* tokens.css @imports its siblings relatively, so it has to be fetched from a
   URL that has a directory -- setContent runs on about:blank, where
   `./palettes.css` resolves to nothing. Same arrangement as mobile-floor. */
const ORIGIN = 'https://field.test';

/** Render a Select-shaped document and measure it. `extraCss` is appended last. */
async function measure({ extraCss = '' } = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'index.html') {
      return route.fulfill({
        contentType: 'text/html',
        /* The markup Select.tsx renders: .ds-field wrapping a <select> that
           carries both .ds-input and .ds-select. */
        body: `<!doctype html><html><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="/tokens.css">
          <link rel="stylesheet" href="/field.css">
          <style>body { margin: 0 } ${extraCss}</style>
          </head><body>
          <main style="padding: 16px">
            <div class="ds-field">
              <label for="s" class="ds-label">Property</label>
              <select id="s" class="ds-input ds-select">
                <option>One</option>
                <option>${LONG_OPTION}</option>
              </select>
            </div>
          </main>
          </body></html>`,
      });
    }

    if (name === 'field.css') {
      return route.fulfill({ contentType: 'text/css', body: readFileSync(FIELD_CSS) });
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
    const select = document.getElementById('s');
    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      selectWidth: Math.round(select.getBoundingClientRect().width),
    };
  });

  await context.close();
  return measured;
}

describeBrowser('a <select> option does not widen the document in WebKit', () => {
  it('does not scroll the page sideways as shipped', async () => {
    const { documentScrollWidth, documentClientWidth } = await measure();

    expect(documentScrollWidth).toBe(documentClientWidth);
    expect(documentClientWidth).toBe(VIEWPORT.width);
  });

  /* The PROXY described in the header -- not the consumer's mechanism, which
     this fixture cannot reproduce. Defeating `width: 100%` is the only lever
     found that makes the leak appear here at all; without `overflow: hidden`
     the document then measures ~935 against a 350 viewport. It earns its place
     by failing when the declaration is removed, not by being faithful. */
  it('still does not, with .ds-input width:100% defeated', async () => {
    const { documentScrollWidth, documentClientWidth } = await measure({
      extraCss: '.ds-input { width: auto }',
    });

    expect(documentScrollWidth).toBe(documentClientWidth);
    expect(documentClientWidth).toBe(VIEWPORT.width);
  });

  /* The fixture has to be capable of showing the leak, or both assertions above
     pass for the wrong reason -- an option that fits proves nothing. Reverting
     the declaration on a control that is free to size itself is the positive
     control: it must leak, and by more than a rounding error. */
  it('leaks when the declaration is reverted, which is what makes the guard real', async () => {
    const { documentScrollWidth, documentClientWidth } = await measure({
      extraCss: '.ds-input { width: auto } .ds-select { overflow: visible }',
    });

    expect(documentScrollWidth).toBeGreaterThan(documentClientWidth);
    /* Not a stray pixel: the whole option string escapes. */
    expect(documentScrollWidth).toBeGreaterThan(VIEWPORT.width * 2);
  });

  /* The control itself is unchanged by the fix -- it is the leak past it that
     the declaration removes, not the control's own size. The consumer measured
     the same thing: 310px with the declaration and 310px without it. */
  it('leaves the control at its container width', async () => {
    const { selectWidth } = await measure();

    expect(selectWidth).toBeGreaterThan(300);
    expect(selectWidth).toBeLessThanOrEqual(VIEWPORT.width);
  });
});
