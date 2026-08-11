/* Pins `cssVariables` to @elirobinson/tokens' `parseTokensCss`.
 *
 * The CLI cannot import that parser at run time without taking a runtime
 * dependency on @elirobinson/tokens, which would defeat the "degrades
 * gracefully when the package is not installed" property (see the comment on
 * cssVariables). A dev-time dependency and this test are the substitute: the
 * two readers must agree on the real stylesheet, or one of them has drifted. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { effectiveTokens, parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import { describe, expect, it } from 'vitest';

import { cssVariables } from './discovery.mjs';

const tokensCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tokens', 'src', 'tokens.css'),
  'utf8',
);

describe('cssVariables', () => {
  it('reads the same names and effective values as the shared parser', () => {
    const shared = [...effectiveTokens(parseTokensCss(tokensCss)).values()].map(
      ({ name, value }) => ({ name, value }),
    );

    expect(cssVariables(tokensCss)).toEqual(shared);
  });

  it('returns nothing rather than throwing when the package is not installed', () => {
    expect(cssVariables(null)).toEqual([]);
  });

  it('ignores declarations outside :root', () => {
    const names = cssVariables(tokensCss).map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('--focus-ring');
  });
});
