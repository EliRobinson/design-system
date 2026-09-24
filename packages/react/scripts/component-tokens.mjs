/* Reading the token a component rule paints, and measuring it.
 *
 * Shared by the tests that measure a component's own pairings per palette x
 * theme — decision-surfaces-contrast and segmented-control-contrast — so the
 * rule parser, the product-layer guard and the "is it declared" checks exist
 * once.
 *
 * Kept out of a *.test.mjs file on purpose: importing one test file from
 * another registers its suites twice. It uses vitest's `expect` so a missing
 * rule, declaration or token fails naming itself rather than as a TypeError.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contrastRatio } from '@elirobinson/tokens/color';
/* Through the exports map, not a `../../tokens/src` path: the same resolver
   packages/tokens gates itself with, which knows the four-block cascade
   including the (0,2,0) slate-dark selector. */
import { COMBINATIONS, combinationValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '..', 'src', 'components');
/* Every token stylesheet, in cascade order. Reading tokens.css alone still
   parses and still returns a few hundred declarations — with no --status-* and
   no brand in them, so every ratio below would resolve to undefined and this
   file would fail on "is not declared" rather than on a colour. */
const TOKEN_SOURCES = readTokenStylesheets();
export const VALUES = Object.fromEntries(
  COMBINATIONS.map((c) => [c.id, combinationValues(TOKEN_SOURCES, c)]),
);

export const sheet = (path) => readFileSync(join(componentsDir, path), 'utf8');

/** Top-level rules as {selector, body}, comments stripped. */
export function rules(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim().replace(/\s+/g, ' '),
    body: match[2],
  }));
}

/**
 * The SYSTEM token a declaration resolves to when no product layer is present.
 *
 * `var(--product-x, var(--system-token))` and a bare `var(--system-token)` both
 * answer `--system-token`: the product layer is optional by construction, so
 * what the system ships is what the last name in the chain resolves to. That is
 * also the only value this file can measure — a product's own palette is the
 * product's to measure, which is why product-layer.test.mjs enforces the
 * fallback rule instead of guessing at values.
 */
export function systemToken(componentsPath, selector, property) {
  const rule = rules(sheet(componentsPath)).find((entry) => entry.selector === selector);
  expect(rule, `${selector} is missing from ${componentsPath}`).toBeDefined();
  const declaration = rule.body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+)`))?.[1];
  expect(
    declaration,
    `${selector} in ${componentsPath} declares no ${property} — a rule that stopped ` +
      'painting is a rule this file can no longer measure.',
  ).toBeDefined();
  const names = [...declaration.matchAll(/--[\w-]+/g)].map((match) => match[0]);
  const token = names.at(-1);
  expect(
    token?.startsWith('--product-'),
    `${selector} in ${componentsPath} resolves ${property} to ${token}, a product ` +
      'variable with no system fallback. See product-layer.test.mjs.',
  ).toBe(false);
  return token;
}

/** Ratio between two token names, resolved inside one palette x theme. */
export function ratio(combination, foreground, background) {
  const fg = VALUES[combination].get(foreground);
  const bg = VALUES[combination].get(background);
  expect(fg, `${foreground} is not declared in ${combination}`).toBeDefined();
  expect(bg, `${background} is not declared in ${combination}`).toBeDefined();
  const measured = contrastRatio(fg, bg);
  expect(
    measured,
    `${foreground} (${fg}) on ${background} (${bg}) is not measurable`,
  ).not.toBeNull();
  return measured;
}
