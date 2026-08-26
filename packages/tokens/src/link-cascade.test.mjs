/* The bare `a` rule's cascade position, measured in a browser.
 *
 * This is not something a unit test can assert. Cascade layers are decided by
 * layer ORDER, which is fixed by first declaration across every stylesheet in
 * the document — there is nothing in tokens.css to read that tells you whether
 * a Tailwind utility beats it. jsdom does not model layers at all. So the check
 * has to be the real question, put to a real engine: put `text-accent-foreground`
 * on an anchor and read `getComputedStyle`, exactly as issue #112 did.
 *
 * The consumer is reconstructed rather than mocked, in the shape the package's
 * own docs prescribe (tailwind.css, "Usage"):
 *
 *   @import 'tailwindcss';                — emits @layer theme, base, components, utilities
 *   @import '@elirobinson/tokens/tokens.css';
 *
 * That order is what makes the layer NAME load-bearing, and it is why this file
 * exists at all: a freshly-invented `@layer ds-base` in tokens.css is declared
 * after Tailwind's four, so it sorts ABOVE `utilities` and the bug survives the
 * fix. Measured here, both ways.
 *
 * Skipped, loudly, when no browser is available — same contract as
 * @elirobinson/ai-patterns' own browser tests. The bare CI image has no
 * Chromium and this must not be what blocks an unrelated change.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const srcDir = dirname(fileURLToPath(import.meta.url));

/* Launching, opening and closing Chromium share the machine with whatever else
   the monorepo is running; the 60s budget and the reason for it are the same as
   in @elirobinson/ai-patterns' src/testing/browser.test-helper.mjs, which is
   not reachable from here — this package does not depend on that one. */
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
    `Skipping link cascade tests: ${chromium ? launchError?.message : 'playwright is not installed'}`,
  );
}

/* A synthetic origin, served from src/ by a route handler. tokens.css @imports
   its siblings relatively, so it has to be fetched from a URL that has a
   directory — `setContent` runs on about:blank, where `./palettes.css` resolves
   to nothing and the whole palette would silently be missing. */
const ORIGIN = 'https://tokens.test';

/* What `@import 'tailwindcss'` puts in front of tokens.css: the layer order
   statement, plus one utility in @layer utilities. `text-accent-foreground` is
   the exact class from issue #112's table, and `@theme inline` compiles it to a
   bare var() of the token — which is what tailwind.css's aliases guarantee, so
   this is the utility Tailwind really emits, not a stand-in. */
const TAILWIND = `
  @layer theme, base, components, utilities;
  @layer utilities {
    .text-accent-foreground { color: var(--accent-fg); }
    .no-underline { text-decoration-line: none; }
  }
`;

/* One representative component rule, unlayered, the way @elirobinson/react
   ships them. Inlined rather than imported from that package: this is a test
   about the cascade position of a rule in THIS file, and it should not go red
   because a component in another package changed its palette.

   Deliberately WITHOUT the `:hover { color: … }` restatement Button.css
   carries. That restatement exists only to out-specify `a:hover` — Button.css
   says so at the top of the file — so writing it here would hide the thing
   under test. This is the accent variant as it looked when the amber-on-amber
   bug was filed, and it is the shape any component outside this repo would
   naturally have. */
const COMPONENT = `
  .ds-button--accent { background: var(--accent); color: var(--accent-fg); }
  .ds-button--accent:hover { background: var(--accent-hover); }
`;

const BODY = `
  <a id="bare" href="#">plain link</a>
  <a id="utility" class="text-accent-foreground" href="#">CTA</a>
  <a id="underline" class="no-underline" href="#">no underline</a>
  <a id="control" class="ds-button ds-button--accent" href="#">View My Work</a>
  <span id="fill" class="ds-button ds-button--accent" data-on-fill>
    <a id="on-fill" href="#">nested</a>
  </span>
  <span id="probe-link"></span>
  <span id="probe-accent-fg"></span>
`;

/**
 * A page holding the real tokens.css, with the consumer stylesheets stacked
 * around it in the given order.
 *
 * @param {string[]} before stylesheet sources emitted ahead of tokens.css
 */
async function consumer(...before) {
  const page = await browser.newPage();

  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'index.html') {
      return route.fulfill({
        contentType: 'text/html',
        /* data-palette="slate" is issue #112's own reproduction — the teal
           brand, whose --accent-fg is white while --link stays ink. Under the
           default ember palette both resolve to --ink-1000 and every assertion
           below would pass on black === black without measuring anything. */
        body: `<!doctype html><html data-palette="slate"><meta charset="utf-8">
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
 * Computed colours, plus the same page's own resolution of the tokens they are
 * being compared against.
 *
 * Comparing rendered rgb() against a token resolved BY THE PAGE, rather than
 * against a literal, is what keeps this test palette- and theme-agnostic: it
 * asserts "the anchor is painted --accent-fg", never "the anchor is #000000".
 */
const measure = (page) =>
  page.evaluate(() => {
    const probe = (id, value) => {
      const element = document.getElementById(id);
      element.style.color = value;
      return getComputedStyle(element).color;
    };
    const color = (id) => getComputedStyle(document.getElementById(id)).color;
    const decoration = (id) => getComputedStyle(document.getElementById(id)).textDecorationLine;

    return {
      link: probe('probe-link', 'var(--link)'),
      accentFg: probe('probe-accent-fg', 'var(--accent-fg)'),
      bare: color('bare'),
      bareDecoration: decoration('bare'),
      utility: color('utility'),
      underline: decoration('underline'),
      control: color('control'),
      controlDecoration: decoration('control'),
      fill: color('fill'),
      onFill: color('on-fill'),
    };
  });

describeBrowser('a Tailwind v4 consumer, wired the way the docs prescribe', () => {
  it('lets a text-* utility paint an anchor — issue #112', async () => {
    const page = await consumer(TAILWIND, COMPONENT);
    const computed = await measure(page);
    await page.close();

    /* The measurement that filed the bug: the CTA carried
       text-accent-foreground and rendered #ffffff on #14b8a6, ~2.1:1. */
    expect(computed.accentFg).not.toBe(computed.link);
    expect(computed.utility).toBe(computed.accentFg);
  });

  it('lets a text-decoration utility clear the underline', async () => {
    const page = await consumer(TAILWIND, COMPONENT);
    const computed = await measure(page);
    await page.close();

    expect(computed.underline).toBe('none');
  });

  it('still styles an anchor nobody asked anything of', async () => {
    /* The reason to layer the rule rather than delete it. An unclassed link is
       the a11y default and has to survive. */
    const page = await consumer(TAILWIND, COMPONENT);
    const computed = await measure(page);
    await page.close();

    expect(computed.bare).toBe(computed.link);
    expect(computed.bareDecoration).toBe('underline');
  });

  it('does not reopen the amber-on-amber regression', async () => {
    /* `.ds-button--accent` is (0,1,0) and lost to `a:hover` at (0,1,1) — an
       anchor-as-button kept its accent fill and had its label repainted
       --link-hover, 2.31:1, SC 1.4.3. Layering `a` cannot bring that back:
       unlayered beats layered whatever the specificity, so the variant wins
       even without the (0,2,0) `:hover` restatement Button.css added to
       out-specify it. Asserted on the hover state, which is where it bit. */
    const page = await consumer(TAILWIND, COMPONENT);
    await page.hover('#control');
    const computed = await measure(page);
    await page.close();

    expect(computed.control).toBe(computed.accentFg);
    /* `a.ds-button { text-decoration: none }` is unlayered too, so it keeps
       winning over the layered underline. */
    expect(computed.controlDecoration).toBe('none');
  });

  it('keeps painting links on a filled surface with --link-on-fill', async () => {
    /* The other half of the on-fill block: an anchor NESTED in a filled surface
       matches the layered `a` rule and the unlayered `[data-on-fill] a` rule,
       and the unlayered one has to keep winning. --link-on-fill is
       `currentColor`, so "it won" means the anchor takes the surface's own
       foreground rather than --link. */
    const page = await consumer(TAILWIND, COMPONENT);
    const computed = await measure(page);
    await page.close();

    expect(computed.fill).not.toBe(computed.link);
    expect(computed.onFill).toBe(computed.fill);
  });
});

describeBrowser('a consumer with no cascade layers at all', () => {
  it('still gets the link default, because unlayered CSS is all there is', async () => {
    const page = await consumer(COMPONENT);
    const computed = await measure(page);
    await page.close();

    expect(computed.bare).toBe(computed.link);
    expect(computed.bareDecoration).toBe('underline');
  });
});

describeBrowser('why the layer is named `base`', () => {
  /* Not a test of tokens.css — a test of the reasoning tokens.css encodes, so
     that "just rename it to something ds-prefixed" cannot land quietly.

     Layer order is fixed by FIRST declaration. Tailwind is imported first and
     declares four names; a fifth name declared afterwards is appended after
     `utilities` and therefore OUTRANKS every utility. Reusing `base` — which
     Tailwind has already ordered below `components` and `utilities` — is the
     only spelling that puts the rule where it belongs. */
  const stack = (layerName) => `
    @layer theme, base, components, utilities;
    @layer utilities { .u { color: rgb(0, 0, 255); } }
    @layer ${layerName} { a { color: rgb(255, 0, 0); } }
  `;

  const resolve = async (css) => {
    const page = await browser.newPage();
    await page.setContent(`<style>${css}</style><a class="u" href="#">x</a>`);
    const color = await page.evaluate(() => getComputedStyle(document.querySelector('a')).color);
    await page.close();
    return color;
  };

  it('`base` sorts below `utilities`, so the utility wins', async () => {
    expect(await resolve(stack('base'))).toBe('rgb(0, 0, 255)');
  });

  it('a fresh `ds-base` sorts above `utilities`, so issue #112 would survive', async () => {
    expect(await resolve(stack('ds-base'))).toBe('rgb(255, 0, 0)');
  });
});
