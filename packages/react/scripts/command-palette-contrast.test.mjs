/* CommandPalette: the active row can be seen in every palette x theme.
 *
 * #275: the active row painted --bg-subtle on a --surface dialog. In dark both
 * are ink-950, 1.00:1, so with nothing typed no row looked chosen and Enter
 * still ran one. A fill alone never reaches 3:1 on this surface, so the row
 * also carries an inset ring (SC 1.4.11). This reads the tokens the shipped
 * stylesheet names and measures them.
 */

import { COMBINATIONS } from '@elirobinson/tokens/contrast';
import { describe, expect, it } from 'vitest';

import { ratio, rules, sheet, systemToken } from './component-tokens.mjs';

const SHEET = 'organisms/CommandPalette.css';
const ACTIVE = '.ds-command-palette__item--active';

const SURFACE = systemToken('organisms/Dialog.css', '.ds-dialog__inner', 'background');
const FILL = systemToken(SHEET, ACTIVE, 'background');
const RING = systemToken(SHEET, ACTIVE, 'box-shadow');
const TEXT = systemToken(SHEET, ACTIVE, 'color');

it('reads the tokens the active row is made of', () => {
  expect(SURFACE).toBe('--surface');
  const active = rules(sheet(SHEET)).find((rule) => rule.selector === ACTIVE);
  expect(active.body).toMatch(/inset\s+0\s+0\s+0\s+1px\s+var\(--/);
  expect(RING).toBe('--border-control');
  expect(FILL).not.toBe('--bg-subtle');
});

describe('the active row stands out from the dialog surface', () => {
  for (const { id } of COMBINATIONS) {
    it(`${id}: the ring clears 3:1 against the surface`, () => {
      expect(ratio(id, RING, SURFACE)).toBeGreaterThanOrEqual(3);
    });

    it(`${id}: the label clears 4.5:1 on the active fill`, () => {
      expect(ratio(id, TEXT, FILL)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
