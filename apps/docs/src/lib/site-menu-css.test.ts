import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { stripComments } from './css-source';

/* #370: the menu button is the only way around the docs below 960px, so it is a
   primary control and holds the 44x44 floor. */
const CSS = stripComments(readFileSync(join(process.cwd(), 'src/app/site.css'), 'utf8'));

function declarations(selector: string): string[] {
  return [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => sel.split(',').some((s) => s.trim() === selector))
    .map(([, , body]) => body);
}

describe('docs menu button', () => {
  it.each(['.site-menu-button', '.site-menu__close'])('%s is at least 44x44', (selector) => {
    const body = declarations(selector).join(';');
    expect(body).toMatch(/min-width:\s*44px/);
    expect(body).toMatch(/min-height:\s*44px/);
  });

  it('is hidden by default and shown only at the width the sidebar hides', () => {
    expect(declarations('.site-menu-button').join(';')).toMatch(/display:\s*none/);
    const narrow = CSS.match(/@media \(max-width: 960px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(narrow).toMatch(/\.site-menu-button\s*\{[^}]*display:\s*inline-flex/);
  });
});
