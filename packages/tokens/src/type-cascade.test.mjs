/* The `.t-*` type classes' colour, and its cascade position, measured in a
 * browser. Sibling of link-cascade.test.mjs, and it exists for the same reason:
 * nothing you can read in tokens.css tells you whether a Tailwind utility beats
 * a rule, because layer order is fixed by first declaration across every
 * stylesheet in the document. jsdom does not model layers at all.
 *
 * Issue #251. Every `.t-*` class but `.t-code` set `color` in an unlayered rule,
 * and unlayered beats every layer whatever the specificity, so
 * `<p class="t-caption text-destructive-ink">` rendered --fg-3 grey. One
 * consumer counted 142 lost colours across 16 pages. The fix is #112's: the
 * colour moved into `@layer base`, where it still paints a type class nobody
 * asked anything else of and loses to anything that states an intent.
 *
 * Skipped, loudly, when no browser is available — same contract as
 * link-cascade.test.mjs. The bare CI image has no Chromium and this must not be
 * what blocks an unrelated change.
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
    `Skipping type cascade tests: ${chromium ? launchError?.message : 'playwright is not installed'}`,
  );
}

/* A synthetic origin, served from src/ by a route handler — tokens.css @imports
   its siblings relatively, so it has to be fetched from a URL that has a
   directory. Verbatim from link-cascade.test.mjs. */
const ORIGIN = 'https://tokens.test';

/* Every type class that paints text, and the token it paints by default. The
   table is the assertion: a class added to tokens.css without a colour, or with
   a different one, fails "keeps its token colour" below rather than passing
   unmeasured. `.t-code` is absent on purpose — it has never set a colour, so it
   inherits, and there is nothing of its own for a utility to beat. */
const TYPE_COLOURS = {
  't-display-1': '--fg',
  't-display-2': '--fg',
  't-h1': '--fg',
  't-h2': '--fg',
  't-h3': '--fg',
  't-h4': '--fg',
  't-h5': '--fg',
  't-lead': '--fg-2',
  't-body': '--fg',
  't-body-sm': '--fg-2',
  't-caption': '--fg-3',
  't-eyebrow': '--fg-2',
  't-mono': '--fg',
};
const TYPE_CLASSES = Object.keys(TYPE_COLOURS);

/* What `@import 'tailwindcss'` puts in front of tokens.css: the layer order
   statement, plus the utility under test. `text-destructive-ink` is the class
   from issue #251's reproduction, and it compiles to a bare var() of the token
   exactly as tailwind.css's `@theme inline` alias makes Tailwind emit it. */
const TAILWIND = `
  @layer theme, base, components, utilities;
  @layer utilities {
    .text-destructive-ink { color: var(--status-danger-fg); }
  }
`;

/* One element per class three ways: bare, carrying the utility, and inside a
   parent that carries it. */
const BODY = `
  ${TYPE_CLASSES.map(
    (name) => `
      <p id="bare-${name}" class="${name}">${name}</p>
      <p id="utility-${name}" class="${name} text-destructive-ink">${name}</p>
      <div class="text-destructive-ink"><p id="child-${name}" class="${name}">${name}</p></div>`,
  ).join('')}
  <a id="anchor" class="t-caption" href="#">caption link</a>
  <p id="code-parent" class="text-destructive-ink"><code id="code" class="t-code">x</code></p>
  <span id="probe"></span>
`;

/**
 * A page holding the real tokens.css, with the consumer stylesheets stacked
 * ahead of it in the given order.
 *
 * @param {{ theme?: 'light' | 'dark', before?: string[] }} options
 */
async function consumer({ theme = 'light', before = [] } = {}) {
  const page = await browser.newPage();

  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'index.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">
          ${before.map((css) => `<style>${css}</style>`).join('\n')}
          <link rel="stylesheet" href="/tokens.css">
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

/**
 * Every measured element's computed colour, plus the page's own resolution of
 * each token those colours are compared against.
 *
 * Comparing against a token resolved BY THE PAGE, rather than a literal, keeps
 * this palette- and theme-agnostic: it asserts "the caption is painted --fg-3",
 * never "the caption is rgb(…)".
 */
const measure = (page) =>
  page.evaluate(
    ({ classes, tokens }) => {
      const probe = document.getElementById('probe');
      const resolve = (token) => {
        probe.style.color = `var(${token})`;
        return getComputedStyle(probe).color;
      };
      const color = (id) => getComputedStyle(document.getElementById(id)).color;

      return {
        token: Object.fromEntries(tokens.map((token) => [token, resolve(token)])),
        bare: Object.fromEntries(classes.map((name) => [name, color(`bare-${name}`)])),
        utility: Object.fromEntries(classes.map((name) => [name, color(`utility-${name}`)])),
        child: Object.fromEntries(classes.map((name) => [name, color(`child-${name}`)])),
        anchor: color('anchor'),
        code: color('code'),
        codeParent: color('code-parent'),
      };
    },
    {
      classes: TYPE_CLASSES,
      tokens: [...new Set([...Object.values(TYPE_COLOURS), '--status-danger-fg', '--link'])],
    },
  );

for (const theme of ['light', 'dark']) {
  describeBrowser(`a Tailwind v4 consumer, ${theme} theme`, () => {
    it('lets a text-* utility on a type class paint it — issue #251', async () => {
      const page = await consumer({ theme, before: [TAILWIND] });
      const computed = await measure(page);
      await page.close();

      /* Without this, a token that happened to resolve to --status-danger-fg
         would pass the assertion below without measuring anything. */
      for (const token of new Set(Object.values(TYPE_COLOURS))) {
        expect(computed.token[token]).not.toBe(computed.token['--status-danger-fg']);
      }
      for (const name of TYPE_CLASSES) {
        expect(computed.utility[name], name).toBe(computed.token['--status-danger-fg']);
      }
    });

    it('keeps each type class its token colour when nothing else is asked', async () => {
      const page = await consumer({ theme, before: [TAILWIND] });
      const computed = await measure(page);
      await page.close();

      for (const [name, token] of Object.entries(TYPE_COLOURS)) {
        expect(computed.bare[name], name).toBe(computed.token[token]);
      }
    });

    it('does not let a parent colour reach a type class', async () => {
      /* Recorded so nobody reads the layer as a fix for this half of the
         issue's report. A declared value beats an inherited one at any layer,
         so a `.t-*` child still paints its own token inside a coloured parent,
         exactly as before. The utility goes on the type-class element itself. */
      const page = await consumer({ theme, before: [TAILWIND] });
      const computed = await measure(page);
      await page.close();

      for (const [name, token] of Object.entries(TYPE_COLOURS)) {
        expect(computed.child[name], name).toBe(computed.token[token]);
      }
    });

    it('keeps the type colour on an anchor that carries a type class', async () => {
      /* The layered `a` rule is (0,0,1) and `.t-caption` (0,1,0), and both now
         sit in `base`, so specificity decides — as it did when the type class
         was unlayered and won outright. */
      const page = await consumer({ theme, before: [TAILWIND] });
      const computed = await measure(page);
      await page.close();

      expect(computed.token['--fg-3']).not.toBe(computed.token['--link']);
      expect(computed.anchor).toBe(computed.token['--fg-3']);
    });

    it('leaves `.t-code` inheriting, as it always has', async () => {
      const page = await consumer({ theme, before: [TAILWIND] });
      const computed = await measure(page);
      await page.close();

      expect(computed.code).toBe(computed.codeParent);
    });
  });
}

describeBrowser('a consumer with no cascade layers at all', () => {
  it('still gets every type colour, because unlayered CSS is all there is', async () => {
    const page = await consumer();
    const computed = await measure(page);
    await page.close();

    for (const [name, token] of Object.entries(TYPE_COLOURS)) {
      expect(computed.bare[name], name).toBe(computed.token[token]);
    }
  });
});
