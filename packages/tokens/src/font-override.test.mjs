/* The font family override hook, and the cascade rule that makes it necessary.
 *
 * A `next/font` app never gets the family under its real name — the framework
 * generates a hashed one and exposes it through a CSS variable — so the literal
 * 'Geist' in tokens.css matches nothing it loaded and the page silently renders
 * in the system font. The three family tokens therefore read a
 * `--ds-font-*-override` first, which a consumer points at the framework's
 * variable.
 *
 * Why these are structural assertions and not a rendered check: the property
 * being pinned is a cascade one, and no DOM implementation available to a node
 * test evaluates it. jsdom drops every rule inside an `@layer` block on the
 * floor — `@layer base { :root { --x: L } }` alone computes to '' — so a jsdom
 * "the layered override did not apply" test would pass whether or not the rule
 * it claims to prove is true. What is asserted here instead is the pair of
 * facts about the shipped stylesheet that the cascade rule follows from, both
 * of which are exactly what a future edit could break:
 *
 *   - tokens.css is unlayered, so a consumer override of --font-sans written
 *     inside `@layer base` loses to it. Unlayered wins over layered at the same
 *     origin, regardless of source order.
 *   - tokens.css never declares a --ds-font-*-override, so a consumer's
 *     override of *that* has nothing to lose to and applies from any layer.
 *
 * The rendered half — computed font-family in a real `next/font` app, with and
 * without the override — is in the PR that introduced the hook (#34).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { effectiveTokens, parseTokensCss } from './parse-tokens-css.mjs';
import { readTokenStylesheets, TOKEN_STYLESHEETS, TOKENS_SRC_DIR } from './token-stylesheets.mjs';

const tokensCss = readFileSync(join(TOKENS_SRC_DIR, 'tokens.css'), 'utf8');
const tokens = effectiveTokens(parseTokensCss(readTokenStylesheets()));

/* Every stylesheet the system @imports, not just the token roster.
 *
 * The two cascade facts below are properties of what a consumer LOADS, and
 * loading tokens.css loads all three of these — it @imports palettes.css and
 * mobile.css at the top. So an `@layer` opened in mobile.css, or a
 * --ds-font-*-override declared in palettes.css, breaks the guarantee exactly
 * as one written here would, and a check that only reads tokens.css would say
 * nothing about it. mobile.css is deliberately absent from TOKEN_STYLESHEETS
 * (it declares no default token) and just as deliberately present here. */
const IMPORTED_STYLESHEETS = [...TOKEN_STYLESHEETS, 'mobile.css'];
const allCss = Object.fromEntries(
  IMPORTED_STYLESHEETS.map((name) => [name, readFileSync(join(TOKENS_SRC_DIR, name), 'utf8')]),
);

/** The stacks as they shipped before the hook existed, character for character. */
const STACKS = {
  '--font-sans': `'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
  '--font-display': `'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif`,
  '--font-mono': `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`,
};

/* The stylesheet's own comments talk about `@layer`, which is not the same as
   being in one. */
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const HOOKS = {
  '--font-sans': '--ds-font-sans-override',
  '--font-display': '--ds-font-display-override',
  '--font-mono': '--ds-font-mono-override',
};

describe('the font family override hook', () => {
  for (const [family, hook] of Object.entries(HOOKS)) {
    it(`${family} reads ${hook} before its own stack`, () => {
      expect(tokens.get(family).value).toBe(`var(${hook}, ${STACKS[family]})`);
    });

    it(`${family} still resolves to the stack it shipped when nobody sets ${hook}`, () => {
      // Purely additive: an unset override is today's exact value.
      expect(tokens.get(family).resolved).toBe(STACKS[family]);
    });
  }

  it('is scoped to the three families — no other token opens itself up', () => {
    const hooked = [...tokens.values()].filter((token) => token.value.includes('-override'));
    expect(hooked.map((token) => token.name).sort()).toEqual([
      '--font-display',
      '--font-mono',
      '--font-sans',
    ]);
  });
});

describe('the cascade rule the hook relies on', () => {
  it.each(IMPORTED_STYLESHEETS)(
    'leaves %s unlayered, which is why a consumer @layer base override of a token loses',
    (name) => {
      // An unlayered declaration beats a layered one at the same origin whatever
      // the source order, so `@layer base { :root { --font-sans: … } }` in a
      // consumer's globals.css silently does nothing. Documented in
      // docs/agents/tokens.md, the README, patterns.md and adopt-system.md; if
      // any of these stylesheets ever moves into a layer, all four are wrong.
      expect(withoutComments(allCss[name])).not.toMatch(/@layer\b/);
    },
  );

  it('never declares an override property, which is why setting one applies from any layer', () => {
    // Nothing to lose to. This is what lets a consumer write the override
    // wherever their base styles already live, layer and all.
    const declared = [...tokens.keys()].filter((name) => name.endsWith('-override'));
    expect(declared).toEqual([]);
  });

  it.each(IMPORTED_STYLESHEETS)(
    'declares no override property anywhere in %s, at any depth',
    (name) => {
      /* The `tokens` check above only sees `:root`, which is the right scope for
       a token but the wrong one for this guarantee: a --ds-font-sans-override
       declared inside `:root[data-platform='mobile']` or a `[data-palette]`
       block would be just as fatal — the consumer's own override would now have
       something to lose to — and would not appear in the token set at all. So
       the text is swept too, comments blanked because tokens.css documents the
       hook with a literal `--ds-font-sans-override: …;` snippet in one. */
      expect(withoutComments(allCss[name])).not.toMatch(/--[\w-]+-override\s*:/);
    },
  );

  it('documents the hook in the stylesheet a consumer actually reads', () => {
    // The snippet in the TYPE section is the copy-paste a next/font app needs.
    // It lives in a comment, so it must not be parsed as a declaration either.
    expect(tokensCss).toContain('--ds-font-sans-override: var(--font-geist-sans);');
    expect(tokens.has('--ds-font-sans-override')).toBe(false);
  });
});
