/* The `.t-*` type classes' colour, and its cascade position, measured in a
 * browser. Sibling of link-cascade.test.mjs, for #251: every `.t-*` class but
 * `.t-code` set `color` unlayered, so a Tailwind text utility on the same
 * element never won. tokens.css's comment above the layered type colours says
 * what the layer does and does not change; this file measures each claim.
 *
 * The browser-free half (which rules are layered, and that they set colour and
 * nothing else) is in font-override.test.mjs, which runs where this skips.
 */

import { beforeAll, expect, it } from 'vitest';

import { BROWSER_BUDGET, bootBrowser, openTokensPage } from './browser.test-helper.mjs';
import { LAYERED_TYPE_COLOURS } from './tokens-css.test-helper.mjs';

const { browser, describeBrowser } = await bootBrowser('type cascade');

/* Read from tokens.css, so a class added there is measured here unedited. */
const TYPE_COLOURS = Object.fromEntries(
  Object.entries(LAYERED_TYPE_COLOURS).map(([selector, token]) => [selector.slice(1), token]),
);
const TYPE_CLASSES = Object.keys(TYPE_COLOURS);

/* What `@import 'tailwindcss'` puts in front of tokens.css: the layer order
   statement, plus the utility under test. `text-destructive-ink` is the class
   from #251's reproduction, spelled as tailwind.css's `@theme inline` alias
   makes Tailwind emit it. */
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

const TOKENS = [
  ...new Set([...Object.values(TYPE_COLOURS), '--status-danger-fg', '--link', '--link-hover']),
];

/**
 * Every measured element's computed colour, plus the page's own resolution of
 * each token they are compared against — so the assertions say "painted
 * --fg-3", never "painted rgb(…)", and hold in every palette and theme.
 */
async function measure({ theme = 'light', before = [] } = {}) {
  const page = await browser.newPage();
  await openTokensPage(
    page,
    `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">
      ${before.map((css) => `<style>${css}</style>`).join('\n')}
      <link rel="stylesheet" href="/tokens.css">
      ${BODY}`,
  );

  const read = () =>
    page.evaluate(
      ({ classes, tokens }) => {
        const probe = document.getElementById('probe');
        const resolve = (token) => {
          probe.style.color = `var(${token})`;
          return getComputedStyle(probe).color;
        };
        const color = (id) => getComputedStyle(document.getElementById(id)).color;
        const each = (prefix) =>
          Object.fromEntries(classes.map((name) => [name, color(`${prefix}-${name}`)]));

        return {
          token: Object.fromEntries(tokens.map((token) => [token, resolve(token)])),
          bare: each('bare'),
          utility: each('utility'),
          child: each('child'),
          anchor: color('anchor'),
          code: color('code'),
          codeParent: color('code-parent'),
        };
      },
      { classes: TYPE_CLASSES, tokens: TOKENS },
    );

  const computed = await read();
  await page.hover('#anchor');
  computed.anchorHover = (await read()).anchor;
  await page.close();
  return computed;
}

for (const theme of ['light', 'dark']) {
  describeBrowser(`a Tailwind v4 consumer, ${theme} theme`, () => {
    let computed;
    beforeAll(async () => {
      computed = await measure({ theme, before: [TAILWIND] });
    }, BROWSER_BUDGET);

    it('lets a text-* utility on a type class paint it — issue #251', () => {
      /* Without this, a token that happened to resolve to --status-danger-fg
         would pass the assertion below without measuring anything. */
      for (const token of new Set(Object.values(TYPE_COLOURS))) {
        expect(computed.token[token]).not.toBe(computed.token['--status-danger-fg']);
      }
      for (const name of TYPE_CLASSES) {
        expect(computed.utility[name], name).toBe(computed.token['--status-danger-fg']);
      }
    });

    it('keeps each type class its token colour when nothing else is asked', () => {
      expect(TYPE_CLASSES.length).toBeGreaterThan(0);
      for (const [name, token] of Object.entries(TYPE_COLOURS)) {
        expect(computed.bare[name], name).toBe(computed.token[token]);
      }
    });

    it('does not let a parent colour reach a type class', () => {
      /* Recorded so nobody reads the layer as a fix for the parent half of the
         issue's report. The utility goes on the type-class element itself. */
      for (const [name, token] of Object.entries(TYPE_COLOURS)) {
        expect(computed.child[name], name).toBe(computed.token[token]);
      }
    });

    it('keeps the type colour on a type-class anchor at rest, and hovers it to --link-hover', () => {
      expect(computed.token['--fg-3']).not.toBe(computed.token['--link']);
      expect(computed.token['--fg-3']).not.toBe(computed.token['--link-hover']);
      expect(computed.anchor).toBe(computed.token['--fg-3']);
      expect(computed.anchorHover).toBe(computed.token['--link-hover']);
    });

    it('leaves `.t-code` inheriting, as it always has', () => {
      expect(computed.code).toBe(computed.codeParent);
    });
  });
}

describeBrowser('a consumer with no cascade layers at all', () => {
  let computed;
  beforeAll(async () => {
    computed = await measure();
  }, BROWSER_BUDGET);

  it('still gets every type colour, because unlayered CSS is all there is', () => {
    for (const [name, token] of Object.entries(TYPE_COLOURS)) {
      expect(computed.bare[name], name).toBe(computed.token[token]);
    }
  });
});
