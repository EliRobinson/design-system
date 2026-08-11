// Deliberately bad fixtures. Each constraint the config claims to cover gets a
// case that must be flagged and a neighbouring case that must not be — a rule
// that fires on everything trains people to disable it.

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import cssModule from '@eslint/css';

import { designSystem } from './index.mjs';
import { designSystemCss } from './css.mjs';
import {
  DESIGN_PROPERTIES,
  axisForCssProperty,
  axisForJsProperty,
  isExempt,
} from './rules/value-patterns.mjs';

const linter = new Linter();

function lint(code, { filename = 'src/app/page.jsx', options } = {}) {
  const config = [
    {
      files: ['**/*.{js,jsx}'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
    ...designSystem(options),
  ];

  return linter.verify(code, config, filename);
}

function lintCss(code, { filename = 'src/app/app.css', options } = {}) {
  return linter.verify(code, designSystemCss(options), filename);
}

const messagesOf = (results) => results.map((result) => result.message);
const rulesOf = (results) => results.map((result) => result.ruleId);

describe('no-barrel-imports', () => {
  it('flags a bare package specifier', () => {
    const results = lint("import { Button } from '@elirobinson/react'");

    expect(rulesOf(results)).toEqual(['no-restricted-imports']);
    expect(messagesOf(results)[0]).toContain('has no barrel export');
  });

  it('flags bare tokens and ai-patterns specifiers too', () => {
    expect(lint("import x from '@elirobinson/tokens'")).toHaveLength(1);
    expect(lint("import x from '@elirobinson/ai-patterns'")).toHaveLength(1);
  });

  it('allows a subpath import', () => {
    expect(
      lint("import { Button } from '@elirobinson/react/components/atoms/Button'"),
    ).toHaveLength(0);
    expect(lint("import '@elirobinson/tokens/tokens.css'")).toHaveLength(0);
  });
});

describe('foreign component libraries', () => {
  it.each([
    '@mui/material',
    '@chakra-ui/react',
    'antd',
    '@mantine/core',
    '@heroui/button',
    '@headlessui/react',
    'daisyui',
    'react-bootstrap',
  ])('flags %s', (specifier) => {
    const results = lint(`import x from '${specifier}'`);

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('Use @elirobinson/react instead');
  });

  it('allows an unrelated package', () => {
    expect(lint("import { z } from 'zod'")).toHaveLength(0);
  });
});

describe('direct Radix imports', () => {
  it('flags a direct primitive import', () => {
    const results = lint("import * as Dialog from '@radix-ui/react-dialog'");

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('already wraps these primitives');
  });

  it('allows it inside the sanctioned gap-filler directory', () => {
    const results = lint("import * as Dialog from '@radix-ui/react-dialog'", {
      filename: 'src/components/ui/dialog.jsx',
    });

    expect(results).toHaveLength(0);
  });

  it('still bans foreign libraries inside the gap-filler directory', () => {
    const results = lint("import x from '@mui/material'", {
      filename: 'src/components/ui/dialog.jsx',
    });

    expect(results).toHaveLength(1);
  });
});

describe('no-hardcoded-design-values: colour', () => {
  it.each([
    ['<div className="bg-[#0f172a]" />', '#0f172a'],
    ['<div className="text-[rgb(15,23,42)]" />', 'rgb(15,23,42)'],
    ['<div className="border-[oklch(72%_0.17_65)]" />', 'oklch'],
    ['<div style={{ color: "#fff" }} />', '#fff'],
    ['<div style={{ backgroundColor: "rgba(0,0,0,.5)" }} />', 'rgba'],
  ])('flags %s', (code, fragment) => {
    const results = lint(`export const A = () => (${code})`);

    expect(rulesOf(results)).toEqual(['@elirobinson/no-hardcoded-design-values']);
    expect(results[0].message).toContain('Hardcoded colour');
    expect(results[0].message).toContain(fragment.slice(0, 6));
  });

  it('flags a literal inside cn()', () => {
    const results = lint(
      `import { cn } from './cn'
       export const A = ({ on }) => <div className={cn('p-4', on && 'bg-[#ff0000]')} />`,
    );

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('Hardcoded colour');
  });

  it('reports a doubly-reachable literal once', () => {
    const results = lint(
      `import { cn } from './cn'
       export const A = () => <div className={cn('bg-[#ff0000]')} />`,
    );

    expect(results).toHaveLength(1);
  });

  it.each([
    '<div className="bg-background text-muted-foreground" />',
    '<div className="text-[var(--fg-2)]" />',
    '<div style={{ color: "var(--fg)" }} />',
    '<div style={{ color: "transparent" }} />',
  ])('allows %s', (code) => {
    expect(lint(`export const A = () => (${code})`)).toHaveLength(0);
  });
});

describe('no-hardcoded-design-values: radius, shadow, motion', () => {
  it.each([
    ['<div className="rounded-[8px]" />', 'radius'],
    ['<div className="rounded-tl-[0.5rem]" />', 'radius'],
    ['<div className="shadow-[0_4px_12px_rgba(0,0,0,0.1)]" />', 'shadow'],
    ['<div className="duration-[200ms]" />', 'motion'],
    ['<div className="ease-[cubic-bezier(0.4,0,0.2,1)]" />', 'motion'],
    ['<div style={{ borderRadius: "8px" }} />', 'radius'],
    ['<div style={{ boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />', 'shadow'],
    ['<div style={{ transitionDuration: "150ms" }} />', 'motion'],
  ])('flags %s', (code, kind) => {
    const results = lint(`export const A = () => (${code})`);

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain(
      { radius: 'Hardcoded radius', shadow: 'Hardcoded shadow', motion: 'Hardcoded motion' }[kind],
    );
  });

  it.each([
    '<div className="rounded-md shadow-sm duration-150" />',
    '<div className="rounded-[var(--radius-md)]" />',
    '<div className="shadow-[var(--shadow-md)]" />',
    '<div className="duration-[var(--dur-fast)]" />',
    '<div style={{ borderRadius: "var(--radius-lg)" }} />',
    '<div className="p-4 gap-2 grid-cols-[1fr_320px]" />',
  ])('allows %s', (code) => {
    expect(lint(`export const A = () => (${code})`)).toHaveLength(0);
  });

  it('leaves layout arbitrary values alone', () => {
    expect(lint('export const A = () => <div className="w-[320px] h-[48px]" />')).toHaveLength(0);
  });
});

describe('configurability', () => {
  it('honours a custom severity', () => {
    const results = lint("import x from '@elirobinson/react'", {
      options: { severity: 'warn' },
    });

    expect(results[0].severity).toBe(1);
  });

  it('honours an allow list', () => {
    const results = lint('export const A = () => <div className="bg-[#ff0000]" />', {
      options: { hardcodedValues: { allow: ['#ff0000'] } },
    });

    expect(results).toHaveLength(0);
  });

  it('honours a custom class-name helper name', () => {
    const results = lint(`export const A = () => <div className={tw('bg-[#ff0000]')} />`, {
      options: { hardcodedValues: { classNameFunctions: ['tw'] } },
    });

    expect(results).toHaveLength(1);
  });

  it('can drop the gap-filler exemption entirely', () => {
    const results = lint("import * as D from '@radix-ui/react-dialog'", {
      filename: 'src/components/ui/dialog.jsx',
      options: { gapFiller: [] },
    });

    expect(results).toHaveLength(1);
  });
});

describe('CSS', () => {
  it('has the css language available', () => {
    expect(cssModule.languages['css']).toBeTruthy();
  });

  it.each([
    ['a { color: #0f172a; }', 'Hardcoded colour'],
    ['a { background-color: oklch(72% 0.17 65); }', 'Hardcoded colour'],
    ['a { border-radius: 8px; }', 'Hardcoded radius'],
    ['a { box-shadow: 0 4px 12px rgba(0,0,0,.1); }', 'Hardcoded shadow'],
    ['a { transition-duration: 200ms; }', 'Hardcoded motion'],
    ['a { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }', 'Hardcoded motion'],
  ])('flags %s', (code, fragment) => {
    const results = lintCss(code);

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain(fragment);
  });

  it.each([
    'a { color: var(--fg); }',
    'a { border-radius: var(--radius-md); }',
    'a { box-shadow: var(--shadow-md); }',
    'a { transition: color var(--dur-fast) var(--ease-out); }',
    'a { padding: 16px; }',
    'a { color: transparent; }',
  ])('allows %s', (code) => {
    expect(lintCss(code)).toHaveLength(0);
  });

  it('leaves custom-property definitions alone — that is what a token is', () => {
    expect(lintCss(':root { --accent: oklch(72.5% 0.175 65); --radius-md: 6px; }')).toHaveLength(0);
  });

  it('can be pointed away from a stylesheet that defines values', () => {
    const results = lintCss('a { color: #fff; }', {
      filename: 'src/styles/tokens.css',
      options: { ignores: ['**/tokens.css'] },
    });

    // Linter#verify still returns the "file is ignored" notice; what matters is
    // that no rule fired.
    expect(results.filter((result) => result.ruleId)).toHaveLength(0);
  });
});

// The two rules answer the same question about a value and only differ in how
// they reach it, so every case below is asserted in both languages. A future
// change that teaches one rule something the other does not know fails here
// rather than shipping — which is how `color(display-p3 ...)` came to be an
// error in a .tsx and silent in a .css.
//
// Exemptions that no check could have flagged anyway — `revert` is the case —
// cannot fail at this level in both languages however wrong they get. Those are
// pinned directly against isExempt below instead.
describe('the JS and CSS rules agree about values', () => {
  it.each([
    {
      what: 'color() is a colour function like any other',
      js: '<div style={{ color: "color(display-p3 1 0 0)" }} />',
      css: 'a { color: color(display-p3 1 0 0); }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a hex literal',
      js: '<div style={{ color: "#0f172a" }} />',
      css: 'a { color: #0f172a; }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a magic radius',
      js: '<div style={{ borderRadius: "8px" }} />',
      css: 'a { border-radius: 8px; }',
      flagged: 'Hardcoded radius',
    },
    {
      what: 'a magic duration',
      js: '<div style={{ transitionDuration: "200ms" }} />',
      css: 'a { transition-duration: 200ms; }',
      flagged: 'Hardcoded motion',
    },
    {
      what: 'zero is zero, not a design decision',
      js: '<div style={{ borderRadius: "0px" }} />',
      css: 'a { border-radius: 0px; }',
      flagged: null,
    },
    {
      what: 'revert is a CSS-wide keyword, valid in a style object too',
      js: '<div style={{ color: "revert" }} />',
      css: 'a { color: revert; }',
      flagged: null,
    },
    {
      // Tailwind v3's dot syntax — theme(colors.slate.200) — is not parseable
      // CSS, so the form that can reach the CSS rule is Tailwind v4's.
      what: "Tailwind's theme() resolves to a token",
      js: '<div style={{ boxShadow: "0 1px 2px theme(--color-slate-200)" }} />',
      css: 'a { box-shadow: 0 1px 2px theme(--color-slate-200); }',
      flagged: null,
    },
    {
      what: 'a var() reference',
      js: '<div style={{ color: "var(--fg)" }} />',
      css: 'a { color: var(--fg); }',
      flagged: null,
    },
  ])('$what', ({ js, css, flagged }) => {
    const jsResults = lint(`export const A = () => (${js})`);
    const cssResults = lintCss(css);

    if (flagged) {
      expect(messagesOf(jsResults)).toHaveLength(1);
      expect(messagesOf(cssResults)).toHaveLength(1);
      expect(jsResults[0].message).toContain(flagged);
      expect(cssResults[0].message).toContain(flagged);
    } else {
      expect(messagesOf(jsResults)).toEqual([]);
      expect(messagesOf(cssResults)).toEqual([]);
    }
  });
});

// The value half of the question is settled above. This is the property half:
// which *axis* a property belongs to — colour, radius, shadow or motion. That
// used to be answered separately in each rule, off a camelCase Set on one side
// and a kebab-case regex on the other, and had drifted the same way the regexes
// had: `filter: drop-shadow(...)` was an error in a style object and silent in a
// stylesheet, and `text-shadow: 0 0 rgb(...)` reported two different message ids
// depending on the language.
//
// Both rules now read the axis from one table in value-patterns.mjs, so a
// property has exactly one axis and both spellings of it resolve to the same
// one. The generated case below walks that table; the hand-written cases pin the
// specific disagreements that were reconciled.
describe('the JS and CSS rules agree about which axis a property belongs to', () => {
  it('every property in the table resolves to the same axis in both spellings', () => {
    expect(DESIGN_PROPERTIES.length).toBeGreaterThan(0);

    for (const { js, css, axis } of DESIGN_PROPERTIES) {
      expect(axisForJsProperty(js)?.name, `${js} (js)`).toBe(axis);
      expect(axisForCssProperty(css)?.name, `${css} (css)`).toBe(axis);
      // Same axis object, not merely the same name — one predicate, not two.
      expect(axisForCssProperty(css), `${css} vs ${js}`).toBe(axisForJsProperty(js));
    }
  });

  it('no property sits on two axes', () => {
    const seen = new Map();

    for (const { js, axis } of DESIGN_PROPERTIES) {
      expect(seen.has(js), `${js} listed twice`).toBe(false);
      seen.set(js, axis);
    }
  });

  it.each([
    {
      what: 'a filter carrying a drop-shadow is a shadow',
      js: '<div style={{ filter: "drop-shadow(0 4px 8px #000)" }} />',
      css: 'a { filter: drop-shadow(0 4px 8px #000); }',
      flagged: 'Hardcoded shadow',
    },
    {
      what: 'a backdrop-filter carrying a drop-shadow is a shadow',
      js: '<div style={{ backdropFilter: "drop-shadow(0 4px 8px #000)" }} />',
      css: 'a { backdrop-filter: drop-shadow(0 4px 8px #000); }',
      flagged: 'Hardcoded shadow',
    },
    {
      // A blur radius is not a shadow, and "use shadow-md" is wrong advice for
      // it. filter only counts on the shadow axis when it carries a shadow.
      what: 'a filter that is not a shadow is not a shadow',
      js: '<div style={{ filter: "blur(4px)" }} />',
      css: 'a { filter: blur(4px); }',
      flagged: null,
    },
    {
      // Reported as a shadow in both, not as a stray colour in one of them:
      // box-shadow's axis is shadow whatever the value happens to carry.
      what: 'a shadow whose only literal is a colour is still a shadow',
      js: '<div style={{ textShadow: "0 0 rgb(0 0 0 / .5)" }} />',
      css: 'a { text-shadow: 0 0 rgb(0 0 0 / .5); }',
      flagged: 'Hardcoded shadow',
    },
    {
      what: 'a box-shadow whose only literal is a colour is still a shadow',
      js: '<div style={{ boxShadow: "0 0 rgb(0 0 0 / .5)" }} />',
      css: 'a { box-shadow: 0 0 rgb(0 0 0 / .5); }',
      flagged: 'Hardcoded shadow',
    },
    {
      what: 'a box-shadow with a magic length is a shadow',
      js: '<div style={{ boxShadow: "0 4px 12px rgba(0,0,0,.1)" }} />',
      css: 'a { box-shadow: 0 4px 12px rgba(0,0,0,.1); }',
      flagged: 'Hardcoded shadow',
    },
    {
      what: 'column-rule-color is a colour',
      js: '<div style={{ columnRuleColor: "#0f172a" }} />',
      css: 'a { column-rule-color: #0f172a; }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a logical border colour is a colour',
      js: '<div style={{ borderBlockColor: "#0f172a" }} />',
      css: 'a { border-block-color: #0f172a; }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a two-segment logical border colour is a colour',
      js: '<div style={{ borderInlineStartColor: "#0f172a" }} />',
      css: 'a { border-inline-start-color: #0f172a; }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a logical border radius is a radius',
      js: '<div style={{ borderStartStartRadius: "8px" }} />',
      css: 'a { border-start-start-radius: 8px; }',
      flagged: 'Hardcoded radius',
    },
  ])('$what', ({ js, css, flagged }) => {
    const jsResults = lint(`export const A = () => (${js})`);
    const cssResults = lintCss(css);

    if (flagged) {
      expect(messagesOf(jsResults)).toHaveLength(1);
      expect(messagesOf(cssResults)).toHaveLength(1);
      expect(jsResults[0].message).toContain(flagged);
      expect(cssResults[0].message).toContain(flagged);
    } else {
      expect(messagesOf(jsResults)).toEqual([]);
      expect(messagesOf(cssResults)).toEqual([]);
    }
  });
});

describe('isExempt', () => {
  it.each([
    ['var(--fg)', true],
    ['theme(colors.accent)', true],
    ['0', true],
    ['0px', true],
    ['revert', true],
    ['  transparent  ', true],
    ['#0f172a', false],
    ['color(display-p3 1 0 0)', false],
    ['0.5rem', false],
    ['revert-layer', false],
  ])('%j is %s', (value, expected) => {
    expect(isExempt(value)).toBe(expected);
  });

  it('a token reference anywhere in the value exempts the whole of it', () => {
    expect(isExempt('0 1px 2px var(--shadow-hue)')).toBe(true);
    expect(isExempt('0 1px 2px theme(--color-slate-200)')).toBe(true);
    expect(isExempt('0 1px 2px #e2e8f0')).toBe(false);
  });
});
