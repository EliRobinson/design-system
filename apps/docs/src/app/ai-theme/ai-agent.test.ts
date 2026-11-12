import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { themeValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

import { aaVerdict, contrastRatio } from '../../lib/color';

// Comments are stripped so a selector's leading comment cannot hide it.
const css = readFileSync(join(import.meta.dirname, 'ai-agent.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);
const sources = readTokenStylesheets();
const THEMES = ['light', 'dark'] as const;
const tokens = {
  light: themeValues(sources, 'light'),
  dark: themeValues(sources, 'dark'),
};

/* Read the fill and label a selector actually declares, so the test follows
   the stylesheet instead of a copy of it. */
function declared(selector: string, prop: string): string {
  const body = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((m) => m[1].split(',').some((s) => s.trim() === selector))
    .map((m) => m[2])
    .join('\n');
  const value = body.match(new RegExp(`(?:^|[\\s;])${prop}:\\s*var\\((--[\\w-]+)\\)`, 'g'));
  const last = value?.at(-1)?.match(/var\((--[\w-]+)\)/)?.[1];
  if (!last) throw new Error(`${selector} declares no ${prop}`);
  return last;
}

const STATES = [
  ['rest', '.ds-ai-confirm__btn--danger'],
  ['hover', '.ds-ai-confirm__btn--danger:hover'],
  ['focus', '.ds-ai-confirm__btn--danger:focus'],
  ['active', '.ds-ai-confirm__btn--danger:active'],
] as const;

describe('the danger confirm button label clears AA on every state', () => {
  it.each(
    THEMES.flatMap((theme) => STATES.map(([state, selector]) => ({ theme, state, selector }))),
  )('$state in $theme', ({ theme, selector }) => {
    const bg = declared(selector, 'background');
    const border = declared(selector, 'border-color');
    const fg = declared(selector, 'color');
    expect(border, 'border follows the fill').toBe(bg);
    const ratio = contrastRatio(tokens[theme].get(fg)!, tokens[theme].get(bg)!);
    expect(ratio).not.toBeNull();
    expect(aaVerdict(ratio!), `${fg} on ${bg} is ${ratio!.toFixed(2)}:1 in ${theme}`).toBe('AA');
  });

  it('uses the danger hover and press tokens, not --status-danger-fg', () => {
    expect(declared('.ds-ai-confirm__btn--danger:hover', 'background')).toBe(
      '--status-danger-hover',
    );
    expect(declared('.ds-ai-confirm__btn--danger:focus', 'background')).toBe(
      '--status-danger-hover',
    );
    expect(declared('.ds-ai-confirm__btn--danger:active', 'background')).toBe(
      '--status-danger-press',
    );
  });
});
