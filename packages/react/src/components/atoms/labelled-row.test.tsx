import { readFileSync } from 'node:fs';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './Checkbox.js';
import { Switch } from './Switch.js';

/* The contract Checkbox and Switch share: a labelled 44px row. Each control's
   own file keeps only what differs. */
describe.each([
  { name: 'Checkbox', Control: Checkbox, role: 'checkbox', block: 'ds-checkbox' },
  { name: 'Switch', Control: Switch, role: 'switch', block: 'ds-switch' },
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
  const css = readFileSync(new URL(sheet, import.meta.url), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  /* Every body whose selector list names `selector`, joined. */
  const rule = (selector: string) =>
    [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(',').some((part) => part.trim() === selector))
      .map(([, , body]) => body)
      .join('\n');

  it('marks the whole disabled row not-allowed and the label disabled', () => {
    const row = `.${block}:has(.${block}__input:disabled)`;

    expect(rule(row)).toContain('cursor: not-allowed');
    expect(rule(`${row} .${block}__label`)).toContain('color: var(--fg-disabled)');
  });
});

/* The one rule every hidden label shares lives in field.css. Sheet names go
   through a variable: Vite rewrites a literal `new URL('x.css', import.meta.url)`
   into an asset import. */
const read = (sheet: string) => readFileSync(new URL(sheet, import.meta.url), 'utf8');

describe('.ds-visually-hidden', () => {
  const sheets = { 'Checkbox.css': read('Checkbox.css'), 'Switch.css': read('Switch.css') };
  const css = read('field.css').replace(/\/\*[\s\S]*?\*\//g, '');

  it('hides visually without removing from the accessibility tree', () => {
    const body = css.match(/\.ds-visually-hidden\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(body).toContain('position: absolute');
    expect(body).toContain('clip-path: inset(50%)');
    expect(body).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });

  it.each(Object.entries(sheets))('%s keeps no copy of it', (_name, source) => {
    expect(source).not.toContain('clip-path');
  });
});
