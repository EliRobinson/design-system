import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

/* The last unguarded link.

   Everything above measures the two themes and the markup that carries them.
   None of it touches the stylesheet that decides which of the pair reaches a
   span — and that decision is where the original bug lived: the colours were
   correct, the markup was fine, and the page still rendered ink on ink because
   nothing re-pointed them when the root element flipped.

   Delete the `[data-theme='dark']` block from site.css today and every other
   test in this file still passes while dark theme regresses to exactly what
   #143 reported. These assertions are what make that impossible. */
describe('the stylesheet that chooses between the two themes', () => {
  const css = readFileSync(join(import.meta.dirname, '../app/site.css'), 'utf8');

  /* Comments stripped first: the file explains itself at length, and a rule
     quoted inside a comment would satisfy a naive search for it. */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const blockFor = (selector: string) => {
    const at = rules.indexOf(selector);
    if (at === -1) return null;
    const open = rules.indexOf('{', at);
    return open === -1 ? null : rules.slice(open, rules.indexOf('}', open));
  };

  it('paints the light column by default', () => {
    const block = blockFor('.code-block__body .shiki span');
    expect(block, 'no unscoped rule targets highlighted spans').not.toBeNull();
    expect(block).toContain('color: var(--shiki-light)');
  });

  it('re-points the dark column under [data-theme="dark"]', () => {
    const block = blockFor("[data-theme='dark'] .code-block__body .shiki span");
    expect(block, 'nothing re-points the colour when the root flips — this is #143').not.toBeNull();
    expect(block).toContain('color: var(--shiki-dark)');
  });

  it('puts the dark rule after the light one, so it wins', () => {
    /* Same specificity would be a coin toss decided by order; the dark
       selector carries an extra attribute and outranks it either way. Both
       facts are asserted because either one alone is a rule that works by
       accident. */
    const light = rules.indexOf('.code-block__body .shiki span');
    const dark = rules.indexOf("[data-theme='dark'] .code-block__body .shiki span");
    expect(dark).toBeGreaterThan(light);
  });

  it('leaves no plain background !important to fight the theme', () => {
    /* The override that caused the pairing to break in the first place: it
       forced a theme-aware background under theme-blind foregrounds. */
    const pre = blockFor('.code-block__body pre');
    expect(pre).not.toBeNull();
    expect(pre).not.toMatch(/background:[^;]*!important/);
  });

  it('scopes every wrapper of highlighted markup to the class the rules match', () => {
    /* The rules key off `.code-block__body`. A third wrapper that renders
       highlight() output under any other class would be matched by neither
       rule and inherit its colour — legible in light by luck, and the #143
       failure again in dark. Asserted against the components rather than
       against a list, so adding one cannot quietly opt out. */
    const dir = join(import.meta.dirname, '../components');
    const wrappers = readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
      .map((f) => ({ file: f, source: readFileSync(join(dir, f), 'utf8') }))
      .filter(({ source }) => /\bhighlight\s*\(/.test(source));

    expect(wrappers.length, 'no component calls highlight() — has it moved?').toBeGreaterThan(0);

    for (const { file, source } of wrappers) {
      expect(source, `${file} renders highlighted markup outside .code-block__body`).toContain(
        'code-block__body',
      );
    }
  });
});
