/* The two halves of the mobile touch-target floor, measured in a browser.
 *
 * tokens.css floors controls to --target twice — once behind
 * `[data-platform="mobile"]`, once under `@media (max-width: 480px) and
 * (pointer: coarse)` — and its own comment calls them the same floor. They were
 * not the same floor: the media half led with a bare `button` at (0,0,1) and
 * lost to `.ds-chip` and `.ds-button--sm` at (0,1,0), while the attribute half
 * led with `:root[data-platform='mobile'] button` at (0,2,1) and won. A
 * responsive coarse-pointer phone therefore got a 32px chip and the same page
 * with the attribute set got a 44px one.
 *
 * Two things are asserted here, and neither can be asserted by reading the
 * file. Specificity is not written down anywhere in CSS; it is a property of
 * how the engine resolves a conflict, so the honest way to check it is to
 * stage a conflict against a competitor of known weight and see which side
 * wins. And "the two halves agree" is a claim about two different rules under
 * two different conditions, which only a real engine can settle.
 *
 * Skipped, loudly, when no browser is available — same contract as this
 * package's link-cascade tests and @elirobinson/ai-patterns' browser suite. The
 * bare CI image has no Chromium and this must not block an unrelated change.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const srcDir = dirname(fileURLToPath(import.meta.url));

/* Same 60s budget, and the same reason, as link-cascade.test.mjs. */
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
    `Skipping mobile floor tests: ${chromium ? launchError?.message : 'playwright is not installed'}`,
  );
}

/* tokens.css @imports its siblings relatively, so it has to be fetched from a
   URL that has a directory. `setContent` runs on about:blank, where
   `./palettes.css` resolves to nothing. */
const ORIGIN = 'https://tokens.test';

/* The two dense controls the two halves used to disagree about, written the way
   a consumer writes them: a chip that is itself a control, and a small button.
   Their heights come from the shipped component stylesheets rather than from a
   literal here — an exclusion is only as good as the geometry it excludes, and
   a fixture that restated `min-height: 32px` would keep passing if Chip.css
   moved, which is the one change that should reopen this. */
const COMPONENT_CSS = `
  .ds-chip { display: inline-flex; align-items: center; min-height: 32px; }
  .ds-button--sm { display: inline-flex; align-items: center; min-height: 36px; }
`;

const BODY = `
  <button id="chip" class="ds-chip" type="button">Chip</button>
  <button id="sm" class="ds-button--sm" type="button">Small</button>
  <button id="plain" type="button">Plain</button>
  <a id="anchor-button" class="ds-button" href="#">Anchor</a>
  <select id="select"><option>One</option></select>
  <input id="range" type="range">
  <button id="dense-marked" data-touch-target="dense" type="button">Marked</button>
`;

async function open({ platform, viewport }) {
  const page = await browser.newPage();
  if (viewport) await page.setViewportSize(viewport);

  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'index.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html${platform ? ` data-platform="${platform}"` : ''}>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="/tokens.css">
          <style>${COMPONENT_CSS}</style>
          ${BODY}`,
      });
    }

    const file = join(srcDir, name);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
      body: readFileSync(file),
    });
  });

  await page.goto(`${ORIGIN}/index.html`);
  return page;
}

const minHeights = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      ['chip', 'sm', 'plain', 'anchor-button', 'select', 'range', 'dense-marked'].map((id) => [
        id,
        getComputedStyle(document.getElementById(id)).minHeight,
      ]),
    ),
  );

/* A coarse pointer is a property of the *context*, not of the page, so it takes
   a new context rather than a viewport change — and the viewport meta above is
   what keeps `isMobile` from laying the page out at 980px, where the 480px
   query would never match and every assertion below would pass vacuously. */
async function coarsePage() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (name === 'index.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="/tokens.css">
          <style>${COMPONENT_CSS}</style>
          ${BODY}`,
      });
    }
    const file = join(srcDir, name);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
      body: readFileSync(file),
    });
  });
  await page.goto(`${ORIGIN}/index.html`);
  return { page, context };
}

describeBrowser('the mobile touch-target floor', () => {
  it('does not fire at all on a fine-pointer desktop', async () => {
    const page = await open({ viewport: { width: 1280, height: 800 } });
    const heights = await minHeights(page);

    expect(heights.plain).toBe('0px');
    expect(heights.chip).toBe('32px');
    expect(heights.sm).toBe('36px');

    await page.close();
  });

  it('floors the primary controls under data-platform="mobile"', async () => {
    const page = await open({ platform: 'mobile', viewport: { width: 1280, height: 800 } });
    const heights = await minHeights(page);

    expect(heights.plain).toBe('44px');
    expect(heights['anchor-button']).toBe('44px');
    expect(heights.select).toBe('44px');

    /* A range input draws its own track and thumb; a min-height stretches the
       track rather than the thumb, so it is excluded from the subject list. */
    expect(heights.range).toBe('0px');

    await page.close();
  });

  /* The inversion. The dense affordances are held out of the floor rather than
     inflated by it, because the contract already measures them — against 24x24,
     WCAG 2.2 AA SC 2.5.8 — and stretching them to 44px would throw away the
     scale they were deliberately drawn at without buying anything the dense
     floor was not already buying. */
  it('leaves the dense affordances at their own scale under data-platform="mobile"', async () => {
    const page = await open({ platform: 'mobile', viewport: { width: 1280, height: 800 } });
    const heights = await minHeights(page);

    expect(heights.chip).toBe('32px');
    expect(heights.sm).toBe('36px');
    expect(heights['dense-marked']).toBe('0px');

    await page.close();
  });

  it('floors the primary controls on a responsive coarse-pointer phone', async () => {
    const { page, context } = await coarsePage();
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBeLessThanOrEqual(
      480,
    );

    const heights = await minHeights(page);
    expect(heights.plain).toBe('44px');
    expect(heights['anchor-button']).toBe('44px');
    expect(heights.select).toBe('44px');
    expect(heights.range).toBe('0px');

    await context.close();
  });

  /* The defect this file exists for: the two halves are one floor, so every
     control has to land on the same number under both, dense ones included. */
  it('agrees with the attribute half on every control, which is the whole point', async () => {
    const attribute = await open({ platform: 'mobile', viewport: { width: 1280, height: 800 } });
    const viaAttribute = await minHeights(attribute);
    await attribute.close();

    const { page, context } = await coarsePage();
    const viaQuery = await minHeights(page);
    await context.close();

    expect(viaQuery).toEqual(viaAttribute);
  });
});

/* Specificity, resolved rather than counted.
 *
 * Both halves are one compound selector whose prefix is (0,2,0) — `:root` is a
 * pseudo-class at (0,1,0), and `[data-platform='mobile']` and
 * `:not([data-platform='mobile'])` are both (0,1,0). The suffix adds
 * `:is(button, …)`, which takes its heaviest argument (`a.ds-button`, (0,1,1)),
 * and `:not(:where(…))`, which is (0,0,0) because `:where()` has no weight. So
 * each half should be (0,3,1).
 *
 * The way to check that without re-doing the arithmetic is to make the engine
 * answer: stage the real rule against synthetic competitors of known weight,
 * declared AFTER it so a tie goes to the competitor. The real rule then wins
 * only against strictly lighter competitors, and the rung where it starts
 * losing is its own.
 */
describeBrowser('the floor resolves at the specificity its comment claims', () => {
  /* A competitor of exactly (0,N,1): N class selectors on an element selector.
     `.w` repeated counts N times even though one class attribute satisfies it,
     which is what makes an arbitrary rung reachable without inventing N real
     classes. */
  const competitor = (n) => `button${'.w'.repeat(n)} { min-height: 7px; }`;

  async function winnerAgainst(n) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.route(`${ORIGIN}/**`, async (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);
      if (name === 'index.html') {
        return route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html data-platform="mobile"><meta charset="utf-8">
            <link rel="stylesheet" href="/tokens.css">
            <style>${competitor(n)}</style>
            <button id="probe" class="w" type="button">probe</button>`,
        });
      }
      const file = join(srcDir, name);
      if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({
        contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
        body: readFileSync(file),
      });
    });
    await page.goto(`${ORIGIN}/index.html`);
    const value = await page.evaluate(
      () => getComputedStyle(document.getElementById('probe')).minHeight,
    );
    await context.close();
    return value === '44px' ? 'floor' : 'competitor';
  }

  it('beats (0,2,1) and (0,1,1), and loses to (0,3,1) declared after it', async () => {
    /* Lighter competitors lose even though they come later in the cascade. */
    expect(await winnerAgainst(1)).toBe('floor');
    expect(await winnerAgainst(2)).toBe('floor');

    /* Equal weight — the later declaration wins, which places the floor at
       exactly (0,3,1) rather than merely "at least (0,3,1)". */
    expect(await winnerAgainst(3)).toBe('competitor');
  });
});
