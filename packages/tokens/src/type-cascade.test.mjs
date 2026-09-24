/* The `.t-*` type classes' cascade position, measured in a browser. Sibling of
 * link-cascade.test.mjs, for #251: every `.t-*` rule was unlayered, so a
 * Tailwind utility on the same element (`text-destructive-ink`, `font-mono`,
 * `text-sm`, `tracking-wide`) never won. The rules now sit in `@layer base`;
 * tokens.css's comment above them says what that does and does not change, and
 * this file measures each claim.
 *
 * "Renders as before" is measured, not remembered: each type-class element is
 * compared with a twin carrying the same declarations as an inline style. An
 * inline style beats every layer, exactly as the unlayered rule did, so the
 * twin IS the old rendering, computed in the same page.
 *
 * The browser-free half (no `.t-*` rule outside a layer) is in
 * font-override.test.mjs, which runs where this skips.
 */

import { beforeAll, expect, it } from 'vitest';

import { BROWSER_BUDGET, bootBrowser, openTokensPage } from './browser.test-helper.mjs';
import { TYPE_RULES } from './tokens-css.test-helper.mjs';

const { browser, describeBrowser } = await bootBrowser('type cascade');

const TYPE_CLASSES = Object.keys(TYPE_RULES);

/* The element each class is measured on. Headings and <code> matter: they are
   what preflight resets with (0,0,1) rules in the same layer. */
const TAG = (name) =>
  ({ 't-display-1': 'h1', 't-display-2': 'h1', 't-code': 'code', 't-mono': 'span' })[name] ??
  (/^t-h[1-6]$/.test(name) ? `h${name.slice(3)}` : 'p');

/* The computed longhands compared between a type-class element and its twin. */
const LONGHANDS = [
  'color',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'fontVariantLigatures',
  'backgroundColor',
  'borderTopWidth',
  'borderTopStyle',
  'borderTopColor',
  'borderTopLeftRadius',
  'paddingTop',
  'paddingLeft',
];

/* One utility per property a type class declares, each setting a value no type
   class uses, and the longhand that shows it. Named `u-<property>` rather than
   after a real Tailwind class because only the layer decides the outcome. A
   type class that declares a property missing here fails the first test below,
   so the table cannot fall behind tokens.css. */
const UTILITIES = {
  color: ['color: var(--status-danger-fg)', 'color'],
  'font-family': ['font-family: Georgia, serif', 'fontFamily'],
  'font-size': ['font-size: 11px', 'fontSize'],
  'font-weight': ['font-weight: 900', 'fontWeight'],
  'line-height': ['line-height: 37px', 'lineHeight'],
  'letter-spacing': ['letter-spacing: 3px', 'letterSpacing'],
  'text-transform': ['text-transform: capitalize', 'textTransform'],
  'font-variant-ligatures': ['font-variant-ligatures: common-ligatures', 'fontVariantLigatures'],
  background: ['background: rgb(1, 2, 3)', 'backgroundColor'],
  border: ['border: 3px dashed rgb(1, 2, 3)', 'borderTopStyle'],
  'border-radius': ['border-radius: 9px', 'borderTopLeftRadius'],
  padding: ['padding: 9px', 'paddingTop'],
};
const utilityClass = (property) => `u-${property}`;

/* What `@import 'tailwindcss'` puts in front of tokens.css: the layer order,
   preflight's resets of the same elements (as Tailwind v4 ships them, in
   `base`), and the utilities. */
const TAILWIND = `
  @layer theme, base, components, utilities;
  @layer base {
    h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
    code, kbd, samp, pre { font-family: ui-monospace, monospace; font-size: 1em; }
    a { color: inherit; }
  }
  @layer utilities {
    ${Object.entries(UTILITIES)
      .map(([property, [declaration]]) => `.${utilityClass(property)} { ${declaration}; }`)
      .join('\n')}
  }
`;

const inline = (declarations) =>
  Object.entries(declarations)
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ');

const BODY = `
  ${Object.keys(UTILITIES)
    .map((property) => `<span id="ref-${property}" class="${utilityClass(property)}">ref</span>`)
    .join('')}
  ${TYPE_CLASSES.map((name) => {
    const tag = TAG(name);
    return `
      <${tag} id="plain-${name}" class="${name}">${name}</${tag}>
      <${tag} id="twin-${name}" style="${inline(TYPE_RULES[name])}">${name}</${tag}>
      ${Object.keys(TYPE_RULES[name])
        .map(
          (property) =>
            `<${tag} id="${property}-${name}" class="${name} ${utilityClass(property)}">${name}</${tag}>`,
        )
        .join('')}
      <div class="${utilityClass('color')} ${utilityClass('font-family')}">
        <${tag} id="child-${name}" class="${name}">${name}</${tag}>
      </div>`;
  }).join('')}
  <a id="anchor" class="t-caption" href="#">caption link</a>
  <span id="probe"></span>
`;

/**
 * Every listed longhand of every element with an id, plus the page's own
 * resolution of the tokens the colour assertions compare against.
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
      ({ longhands, tokens }) => {
        const probe = document.getElementById('probe');
        const resolve = (token) => {
          probe.style.color = `var(${token})`;
          return getComputedStyle(probe).color;
        };
        const styles = {};
        for (const element of document.querySelectorAll('[id]')) {
          const style = getComputedStyle(element);
          styles[element.id] = Object.fromEntries(longhands.map((name) => [name, style[name]]));
        }
        return {
          token: Object.fromEntries(tokens.map((token) => [token, resolve(token)])),
          styles,
        };
      },
      { longhands: LONGHANDS, tokens: ['--fg-3', '--link', '--link-hover'] },
    );

  const computed = await read();
  await page.hover('#anchor');
  computed.anchorHover = (await read()).styles.anchor.color;
  await page.close();
  return computed;
}

it('has a utility for every property a type class declares', () => {
  expect(TYPE_CLASSES.length).toBeGreaterThan(0);
  for (const [name, declarations] of Object.entries(TYPE_RULES)) {
    for (const property of Object.keys(declarations)) {
      expect(UTILITIES, `${name} declares ${property}`).toHaveProperty([property]);
    }
  }
});

for (const theme of ['light', 'dark']) {
  describeBrowser(`a Tailwind v4 consumer, ${theme} theme`, () => {
    let computed;
    beforeAll(async () => {
      computed = await measure({ theme, before: [TAILWIND] });
    }, BROWSER_BUDGET);

    it('lets a utility win for every property a type class sets — issue #251', () => {
      for (const name of TYPE_CLASSES) {
        for (const property of Object.keys(TYPE_RULES[name])) {
          const [, longhand] = UTILITIES[property];
          const expected = computed.styles[`ref-${property}`][longhand];
          /* Guards against a utility whose value happens to match the class. */
          expect(computed.styles[`plain-${name}`][longhand], `${name} ${property}`).not.toBe(
            expected,
          );
          expect(computed.styles[`${property}-${name}`][longhand], `${name} ${property}`).toBe(
            expected,
          );
        }
      }
    });

    it('renders a plain type-class element exactly as the unlayered rule did', () => {
      for (const name of TYPE_CLASSES) {
        expect(computed.styles[`plain-${name}`], name).toEqual(computed.styles[`twin-${name}`]);
      }
    });

    it('does not let a parent colour or font reach a type class', () => {
      /* A declared value beats an inherited one in any layer, so the utility
         goes on the type-class element itself. */
      for (const name of TYPE_CLASSES) {
        const child = computed.styles[`child-${name}`];
        const plain = computed.styles[`plain-${name}`];
        expect(child.fontFamily, name).toBe(plain.fontFamily);
        if ('color' in TYPE_RULES[name]) expect(child.color, name).toBe(plain.color);
      }
    });

    it('keeps the type colour on a type-class anchor at rest, and hovers it to --link-hover', () => {
      expect(computed.token['--fg-3']).not.toBe(computed.token['--link']);
      expect(computed.token['--fg-3']).not.toBe(computed.token['--link-hover']);
      expect(computed.styles.anchor.color).toBe(computed.token['--fg-3']);
      expect(computed.anchorHover).toBe(computed.token['--link-hover']);
    });
  });
}

describeBrowser('a consumer with no cascade layers at all', () => {
  let computed;
  beforeAll(async () => {
    computed = await measure();
  }, BROWSER_BUDGET);

  it('renders a plain type-class element exactly as the unlayered rule did', () => {
    for (const name of TYPE_CLASSES) {
      expect(computed.styles[`plain-${name}`], name).toEqual(computed.styles[`twin-${name}`]);
    }
  });
});
