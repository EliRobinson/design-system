import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { aaVerdict, contrastRatio } from '@elirobinson/tokens/color';
import { COMBINATIONS, combinationValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

import { prop, stripComments } from './css-source';

/* #374: the danger confirm button filled hover with --status-danger-fg, a text
   colour. In dark that is a light red, and the white label on it measured about
   2.5:1. The button must use the danger fill tokens made for this label, and
   the label must clear AA on every state under every palette and theme. */

const css = stripComments(
  readFileSync(join(process.cwd(), 'src/app/ai-theme/ai-agent.css'), 'utf8'),
);
const sheets = readTokenStylesheets().map(stripComments);

const BUTTON = '.ds-ai-confirm__btn--danger';
const STATES = [
  ['rest', BUTTON, '--status-danger'],
  ['hover', `${BUTTON}:hover`, '--status-danger-hover'],
  ['focus', `${BUTTON}:focus`, '--status-danger-hover'],
  ['active', `${BUTTON}:active`, '--status-danger-press'],
] as const;

/* The token a declaration reads: `var(--x)` gives `--x`. */
function token(selector: string, property: string): string {
  const name = prop(css, selector, property).match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1];
  if (!name) throw new Error(`${selector} ${property} is not a single var()`);
  return name;
}

describe('the danger confirm button', () => {
  it.each(STATES)('%s (%s) fills with %s, border and all', (_state, selector, fill) => {
    expect(token(selector, 'background')).toBe(fill);
    expect(token(selector, 'border-color')).toBe(fill);
  });

  describe.each(COMBINATIONS)('$palette / $theme', (combination) => {
    const values = combinationValues(sheets, combination);

    it.each(STATES)('%s label clears AA', (_state, selector) => {
      const label = token(selector, 'color');
      const fill = token(selector, 'background');
      const [fg, bg] = [label, fill].map((name): string => {
        const value = values.get(name);
        if (!value) throw new Error(`cannot resolve ${name}`);
        return value;
      });
      const ratio = contrastRatio(fg, bg)!;
      expect(aaVerdict(ratio), `${label} on ${fill} is ${ratio.toFixed(2)}:1`).toBe('AA');
    });
  });
});
