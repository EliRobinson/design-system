import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './Checkbox.js';
import { Switch } from './Switch.js';

/* Sheet names go through a variable: Vite rewrites a literal
   `new URL('x.css', import.meta.url)` into an asset import. Comments are
   stripped so a rule named in prose never counts. */
const read = (sheet: string) =>
  readFileSync(new URL(sheet, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* Every body whose selector list names `selector`, joined. */
const rule = (css: string, selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(',').some((part) => part.trim() === selector))
    .map(([, , body]) => body)
    .join('\n');

/* The contract Checkbox and Switch share: a labelled 44px row. Each control's
   own file keeps only what differs. */
describe.each([
  { name: 'Checkbox', Control: Checkbox, role: 'checkbox' },
  { name: 'Switch', Control: Switch, role: 'switch' },
])('$name labelled row', ({ Control, role }) => {
  it('keeps the accessible name when hideLabel is set', () => {
    render(<Control label="Notifications" hideLabel />);

    expect(screen.getByRole(role, { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toHaveClass('ds-visually-hidden');
  });

  it('draws the label when hideLabel is not set', () => {
    render(<Control label="Notifications" />);

    expect(screen.getByText('Notifications')).not.toHaveClass('ds-visually-hidden');
  });
});

/* jsdom paints no CSS, so these pin the rules a test cannot see: delete one and
   the label draws again, or a disabled row looks live. */
describe.each([
  { block: 'ds-checkbox', sheet: 'Checkbox.css' },
  { block: 'ds-switch', sheet: 'Switch.css' },
])('$block stylesheet', ({ block, sheet }) => {
  const css = read(sheet);

  it('marks the whole disabled row not-allowed and the label disabled', () => {
    const row = `.${block}:has(.${block}__input:disabled)`;

    expect(rule(css, row)).toContain('cursor: not-allowed');
    expect(rule(css, `${row} .${block}__label`)).toContain('color: var(--fg-disabled)');
  });

  if (block === 'ds-checkbox') {
    it('keeps the 44px row width when the label is hidden', () => {
      expect(rule(css, '.ds-checkbox:has(> .ds-checkbox__label.ds-visually-hidden)')).toContain(
        'min-width: var(--target)',
      );
    });
  }
});

/* The one rule every hidden label shares lives in field.css. */
describe('.ds-visually-hidden', () => {
  it('is the only copy: no other component sheet hides text itself', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
    const copies = readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.css') && !file.endsWith('field.css'))
      .filter((file) =>
        /clip-path:\s*inset\(50%\)|clip:\s*rect\(/.test(readFileSync(join(dir, file), 'utf8')),
      );

    expect(copies).toEqual([]);
  });

  it('hides visually without removing from the accessibility tree', () => {
    const body = rule(read('field.css'), '.ds-visually-hidden');

    expect(body).toContain('position: absolute');
    expect(body).toContain('clip-path: inset(50%)');
    expect(body).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });
});
