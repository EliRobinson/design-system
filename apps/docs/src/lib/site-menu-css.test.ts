import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarations, readSiteCss } from './css-source';

/* #370: the menu button is the only way around the docs below 960px, so it is a
   primary control and holds the 44x44 floor. */
const CSS = readSiteCss();
const NARROW = CSS.match(/@media \(max-width: 960px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
const MENU_SOURCE = readFileSync(join(process.cwd(), 'src/components/SiteMenu.tsx'), 'utf8');

describe('docs menu', () => {
  it.each(['.site-menu-button', '.site-menu__close', '.site-menu__link'])(
    '%s is at least 44px',
    (selector) => {
      const body = declarations(CSS, selector);
      expect(body).toMatch(/min-height:\s*44px/);
    },
  );

  it.each(['.site-menu-button', '.site-menu__close'])('%s is at least 44px wide', (selector) => {
    expect(declarations(CSS, selector)).toMatch(/min-width:\s*44px/);
  });

  it('keeps the tree links in the sheet at 44px', () => {
    expect(declarations(CSS, '.site-menu .ds-navigation-menu__link')).toMatch(/min-height:\s*44px/);
  });

  it('shows the button only at the width the sidebar hides', () => {
    expect(declarations(CSS, '.site-menu-button')).toMatch(/display:\s*none/);
    expect(NARROW).toMatch(/\.site-menu-button\s*\{[^}]*display:\s*inline-flex/);
  });

  // The sheet must keep the docs tree while the sidebar is hidden. The tree is
  // `.site-nav`; the hidden column is `.site-sidebar`. If the sheet wore the
  // sidebar's class it would vanish with it.
  it('hides the sidebar column below 960px without hiding the tree', () => {
    expect(NARROW).toMatch(/\.site-sidebar\s*\{[^}]*display:\s*none/);
    expect(NARROW).not.toMatch(/\.site-nav\s*\{[^}]*display:\s*none/);
    expect(MENU_SOURCE).not.toContain('site-sidebar');
  });
});
