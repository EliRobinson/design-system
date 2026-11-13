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

/* A menu with a panel of its own sits on that panel's background, read from the
   stylesheet. The nav has no panel: it sits on the page, or on a --surface the
   consumer puts it in, so its grounds are listed. `disabled` is a rule that
   must reset the fill and the ring. */
const MENUS = [
  {
    name: 'DropdownMenu',
    path: 'organisms/DropdownMenu.css',
    panel: '.ds-dropdown__content',
    states: ['.ds-dropdown__item:hover, .ds-dropdown__item:focus-visible'],
    disabled: ".ds-dropdown__item:disabled, .ds-dropdown__item[aria-disabled='true']",
  },
  {
    name: 'NavigationMenu',
    path: 'organisms/NavigationMenu.css',
    grounds: ['--bg', '--surface', '--bg-subtle'],
    states: [
      '.ds-navigation-menu .ds-navigation-menu__link:hover, .ds-navigation-menu .ds-navigation-menu__link--active',
    ],
  },
];

describe.each(MENUS)('$name', ({ path, panel, grounds: listed, states, disabled }) => {
  const body = (selector) => rules(sheet(path)).find((r) => r.selector === selector)?.body;
  const grounds = panel ? [systemToken(path, panel, 'background')] : listed;

  it('reads the tokens the item is made of', () => {
    if (panel) expect(grounds).toEqual(['--surface']);
    for (const state of states) {
      expect(body(state), state).toMatch(INSET_RING);
      expect(systemToken(path, state, 'box-shadow')).toBe('--border-control');
      expect(systemToken(path, state, 'background')).toBe('--surface-3');
    }
  });

  if (disabled) {
    it('a disabled item takes no hover fill or ring', () => {
      expect(body(disabled)).toMatch(/background:\s*transparent/);
      expect(body(disabled)).toMatch(/box-shadow:\s*none/);
    });
  }

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
