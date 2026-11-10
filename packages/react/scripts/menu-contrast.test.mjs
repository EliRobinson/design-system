/* DropdownMenu and NavigationMenu: the hovered and current item can be seen in
 * every palette x theme.
 *
 * #354: DropdownMenu painted --bg-subtle on a --surface panel, and
 * NavigationMenu painted --bg-subtle on the page. In dark --bg-subtle and
 * --surface are both ink-950, 1.00:1, so nothing looked chosen. Same fix and
 * same test as CommandPalette (#275) and Combobox (#302): a fill plus an inset
 * ring (SC 1.4.11). This reads the tokens the shipped stylesheets name and
 * measures them.
 */

import { COMBINATIONS } from '@elirobinson/tokens/contrast';
import { describe, expect, it } from 'vitest';

import { ratio, rules, sheet, systemToken } from './component-tokens.mjs';

const INSET_RING = /inset\s+0\s+0\s+0\s+1px\s+var\(--/;

/* `grounds` are the tokens the item can sit on. The nav has no surface of its
   own: it sits on the page, or on a --surface the consumer puts it in. */
const MENUS = [
  {
    name: 'DropdownMenu',
    path: 'organisms/DropdownMenu.css',
    grounds: ['--surface'],
    states: ['.ds-dropdown__item:hover, .ds-dropdown__item:focus-visible'],
  },
  {
    name: 'NavigationMenu',
    path: 'organisms/NavigationMenu.css',
    grounds: ['--bg', '--surface'],
    states: ['.ds-navigation-menu__link:hover', '.ds-navigation-menu__link--active'],
  },
];

describe.each(MENUS)('$name', ({ path, grounds, states }) => {
  it('reads the tokens the item is made of', () => {
    if (path.includes('Dropdown')) {
      expect(systemToken(path, '.ds-dropdown__content', 'background')).toBe('--surface');
    }
    for (const state of states) {
      const rule = rules(sheet(path)).find((r) => r.selector === state);
      expect(rule?.body, state).toMatch(INSET_RING);
      expect(systemToken(path, state, 'box-shadow')).toBe('--border-control');
      expect(systemToken(path, state, 'background')).toBe('--surface-3');
    }
  });

  describe.each(states)('%s stands out from its ground', (state) => {
    const fill = systemToken(path, state, 'background');
    const ring = systemToken(path, state, 'box-shadow');
    const text = systemToken(path, state, 'color');

    for (const { id } of COMBINATIONS) {
      for (const ground of grounds) {
        it(`${id}: the ring clears 3:1 against ${ground}`, () => {
          expect(ratio(id, ring, ground)).toBeGreaterThanOrEqual(3);
        });
      }

      it(`${id}: the label clears 4.5:1 on the fill`, () => {
        expect(ratio(id, text, fill)).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
});

describe('DropdownMenu: a disabled item takes no hover fill or ring', () => {
  it('resets the fill and the ring', () => {
    const rule = rules(sheet('organisms/DropdownMenu.css')).find(
      (r) => r.selector === ".ds-dropdown__item:disabled, .ds-dropdown__item[aria-disabled='true']",
    );
    expect(rule?.body).toMatch(/background:\s*transparent/);
    expect(rule?.body).toMatch(/box-shadow:\s*none/);
  });
});
