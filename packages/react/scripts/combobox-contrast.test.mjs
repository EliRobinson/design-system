/* Combobox: the active option can be seen in every palette x theme.
 *
 * #302: the active option painted --bg-subtle on a --surface list. In dark both
 * are ink-950, 1.00:1. Same fix and same test as CommandPalette (#275): a fill
 * plus an inset ring (SC 1.4.11). This reads the tokens the shipped stylesheet
 * names and measures them.
 */

import { COMBINATIONS } from '@elirobinson/tokens/contrast';
import { describe, expect, it } from 'vitest';

import { ratio, rules, sheet, systemToken } from './component-tokens.mjs';

const SHEET = 'organisms/Combobox.css';
const ACTIVE = '.ds-combobox__option--active';

const SURFACE = systemToken(SHEET, '.ds-combobox__list', 'background');
const FILL = systemToken(SHEET, ACTIVE, 'background');
const RING = systemToken(SHEET, ACTIVE, 'box-shadow');
const TEXT = systemToken(SHEET, '.ds-combobox__option', 'color');

it('reads the tokens the active option is made of', () => {
  expect(SURFACE).toBe('--surface');
  const active = rules(sheet(SHEET)).find((rule) => rule.selector === ACTIVE);
  expect(active.body).toMatch(/inset\s+0\s+0\s+0\s+1px\s+var\(--/);
  expect(RING).toBe('--border-control');
  expect(FILL).toBe('--surface-3');
});

describe('the active option stands out from the list surface', () => {
  for (const { id } of COMBINATIONS) {
    it(`${id}: the ring clears 3:1 against the surface`, () => {
      expect(ratio(id, RING, SURFACE)).toBeGreaterThanOrEqual(3);
    });

    it(`${id}: the label clears 4.5:1 on the active fill`, () => {
      expect(ratio(id, TEXT, FILL)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
