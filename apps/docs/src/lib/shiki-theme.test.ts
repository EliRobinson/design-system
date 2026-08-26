import { themeValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { codeToHtml } from 'shiki';
import { describe, expect, it } from 'vitest';

import { aaVerdict, contrastRatio, toHex } from './color';
import { highlight } from './highlight';
import { CODE_BACKGROUND, miltinsonDark, miltinsonLight, SCOPE_RULES } from './shiki-theme';

const VARIANTS = ['light', 'dark'] as const;

/* A snippet that hits most of the scope table at once: a comment, a keyword,
   a string, a type, a function call and punctuation. */
const SNIPPET = `// a greeting
export function greet(name: string) {
  return \`hello \${name}\`;
}`;

const sources = readTokenStylesheets();
const tokens = {
  light: themeValues(sources, 'light'),
  dark: themeValues(sources, 'dark'),
};

describe('the code background each theme is measured against', () => {
  it.each(VARIANTS)('matches what --bg-muted resolves to in %s', (variant) => {
    /* The bug that made the light theme's AA claim false: its background was
       pinned at #f6f7f8 while --bg-muted resolves a shade darker, so every
       ratio in the file was computed against a lighter well than the one on
       screen. Reading the token rather than trusting the literal is what keeps
       the two from drifting again. */
    expect(CODE_BACKGROUND[variant]).toBe(toHex(tokens[variant].get('--bg-muted')!));
  });
});

describe('every scope colour is a ramp step', () => {
  it.each(
    SCOPE_RULES.flatMap((rule) =>
      VARIANTS.map((variant) => ({
        scope: rule.scope[0],
        variant,
        hex: rule[variant],
        token: rule.token[variant],
      })),
    ),
  )('$scope in $variant is $token', ({ variant, hex, token }) => {
    const value = tokens[variant].get(token);
    expect(value, `${token} is not declared`).toBeDefined();
    expect(toHex(value!)).toBe(hex);
  });
});

describe('every scope colour clears WCAG AA on its own background', () => {
  it.each(
    SCOPE_RULES.flatMap((rule) =>
      VARIANTS.map((variant) => ({ scope: rule.scope[0], variant, hex: rule[variant] })),
    ),
  )('$scope on the $variant code background', ({ variant, hex }) => {
    /* The dark-theme bug this suite was added for: a single theme's light
       hexes stayed on the spans when the root flipped, and --ink-800 on
       --ink-900 measured 1.12:1. Any regression that re-points a scope at the
       wrong theme's ramp lands here as a number, not as a screenshot. */
    const ratio = contrastRatio(hex, CODE_BACKGROUND[variant]);
    expect(ratio).not.toBeNull();
    expect(
      aaVerdict(ratio!),
      `${hex} on ${CODE_BACKGROUND[variant]} is ${ratio!.toFixed(2)}:1`,
    ).toBe('AA');
  });
});

describe('the themes shiki actually receives', () => {
  it.each(VARIANTS)('carries every scope rule in %s', (variant) => {
    const theme = variant === 'light' ? miltinsonLight : miltinsonDark;
    expect(theme.type).toBe(variant);
    expect(theme.settings).toHaveLength(SCOPE_RULES.length);
    /* The rules belong in `settings`, where shiki reads them. Moving them to
       `tokenColors` reintroduces the promotion step that only runs when
       `settings` is absent — and `settings` cannot be absent, because the type
       requires it. */
    expect(theme.tokenColors).toBeUndefined();
  });

  it.each(VARIANTS)(
    'survives normalization and paints more than one colour in %s',
    async (variant) => {
      const html = await codeToHtml(SNIPPET, {
        lang: 'ts',
        theme: variant === 'light' ? miltinsonLight : miltinsonDark,
      });
      const painted = new Set(
        [...html.matchAll(/(?<!background-)color:(#[0-9a-fA-F]{6})/g)].map((m) =>
          m[1].toLowerCase(),
        ),
      );
      /* One colour means the scope table was discarded and every token fell back
       to `editor.foreground` — which is exactly how this rendered before, and
       it looks like a deliberate monochrome theme rather than a failure. */
      expect(painted.size).toBeGreaterThan(3);
      for (const hex of painted) {
        const ratio = contrastRatio(hex, CODE_BACKGROUND[variant])!;
        expect(aaVerdict(ratio), `${hex} is ${ratio.toFixed(2)}:1`).toBe('AA');
      }
    },
  );
});

describe('the markup highlight() emits', () => {
  it('carries both themes and commits to neither', async () => {
    const html = await highlight(SNIPPET, 'ts');
    expect(html).toContain('--shiki-light:');
    expect(html).toContain('--shiki-dark:');
    /* `defaultColor` left on would also emit a plain `color:` per span, which
       beats the custom property the stylesheet selects with — the dark theme
       would be in the markup and still never reach the screen. */
    expect(html).not.toMatch(/(?<!-)\bcolor:#[0-9a-fA-F]{6}/);
  });
});
