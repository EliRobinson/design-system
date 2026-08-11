// Deliberately bad fixtures. Each constraint the config claims to cover gets a
// case that must be flagged and a neighbouring case that must not be — a rule
// that fires on everything trains people to disable it.

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import cssModule from '@eslint/css';

import { designSystem } from './index.mjs';
import { designSystemCss } from './css.mjs';
import { AXIS_PROPERTIES, axisOf, isExempt, toCamelCase } from './rules/value-patterns.mjs';

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
const messageIdsOf = (results) => results.map((result) => result.messageId);

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

// The value half of the two rules is shared, so it cannot drift. The property
// half is what this table pins: the same declaration, spelled camelCase in a
// style object and kebab-case in a stylesheet, has to reach the same messageId.
// Asserting on the id rather than the prose is deliberate — consumers pin ids
// in eslint-disable comments and in their own severity overrides, so an id that
// silently changes axis is a breaking change even when both rules still fire.
describe('the JS and CSS rules agree about properties', () => {
  it.each([
    {
      what: 'a filter carries a shadow only when it names one',
      kebab: 'filter',
      value: 'drop-shadow(0 4px 8px #000)',
      messageId: 'shadow',
    },
    {
      what: 'a blur radius is not a shadow, and no shadow token fixes it',
      kebab: 'filter',
      value: 'blur(4px)',
      messageId: null,
    },
    {
      what: 'backdrop-filter is judged the same way as filter',
      kebab: 'backdrop-filter',
      value: 'drop-shadow(0 4px 8px #000)',
      messageId: 'shadow',
    },
    {
      what: 'a backdrop blur is not a shadow either',
      kebab: 'backdrop-filter',
      value: 'blur(12px)',
      messageId: null,
    },
    {
      // The shadow axis owns box-shadow and text-shadow outright, colour and
      // all — "use a shadow token" is the more actionable of the two messages.
      what: 'a colour-only text-shadow is still a shadow, not a stray colour',
      kebab: 'text-shadow',
      value: '0 0 rgb(0 0 0 / .5)',
      messageId: 'shadow',
    },
    {
      what: 'a colour-only box-shadow is a shadow too',
      kebab: 'box-shadow',
      value: '0 0 rgb(0 0 0 / .5)',
      messageId: 'shadow',
    },
    {
      what: 'a box-shadow with a magic length',
      kebab: 'box-shadow',
      value: '0 1px 2px #e2e8f0',
      messageId: 'shadow',
    },
    {
      what: 'column-rule-color is a colour property',
      kebab: 'column-rule-color',
      value: '#fff',
      messageId: 'color',
    },
    {
      what: 'a logical border colour',
      kebab: 'border-block-color',
      value: '#fff',
      messageId: 'color',
    },
    {
      what: 'a one-sided logical border colour',
      kebab: 'border-inline-start-color',
      value: '#fff',
      messageId: 'color',
    },
    {
      what: 'a logical corner radius',
      kebab: 'border-start-start-radius',
      value: '8px',
      messageId: 'radius',
    },
    {
      what: 'a physical corner radius',
      kebab: 'border-top-left-radius',
      value: '8px',
      messageId: 'radius',
    },
    { what: 'plain colour', kebab: 'color', value: '#0f172a', messageId: 'color' },
    { what: 'accent-color', kebab: 'accent-color', value: '#0f172a', messageId: 'color' },
    { what: 'caret-color', kebab: 'caret-color', value: 'rgb(15 23 42)', messageId: 'color' },
    { what: 'fill', kebab: 'fill', value: '#0f172a', messageId: 'color' },
    { what: 'stroke', kebab: 'stroke', value: '#0f172a', messageId: 'color' },
    {
      what: 'transition-duration',
      kebab: 'transition-duration',
      value: '200ms',
      messageId: 'duration',
    },
    {
      what: 'animation-timing-function',
      kebab: 'animation-timing-function',
      value: 'cubic-bezier(0.4, 0, 0.2, 1)',
      messageId: 'duration',
    },
    {
      // The rule owns four axes. Widening the shared table must not quietly
      // recruit layout properties into one of them.
      what: 'a width is not a design-system axis',
      kebab: 'width',
      value: '8px',
      messageId: null,
    },
    {
      what: 'padding is Tailwind’s scale to own, not this rule’s',
      kebab: 'padding',
      value: '16px',
      messageId: null,
    },
    {
      what: 'a token reference is exempt on every axis',
      kebab: 'box-shadow',
      value: 'var(--shadow-md)',
      messageId: null,
    },
  ])('$what — $kebab: $value', ({ kebab, value, messageId }) => {
    const camel = toCamelCase(kebab);
    const js = lint(
      `export const A = () => (<div style={{ ${camel}: ${JSON.stringify(value)} }} />)`,
    );
    const css = lintCss(`a { ${kebab}: ${value}; }`);

    expect(messageIdsOf(js)).toEqual(messageId ? [messageId] : []);
    expect(messageIdsOf(css)).toEqual(messageId ? [messageId] : []);
  });
});

describe('axisOf', () => {
  it('maps every shared property to one axis in either spelling', () => {
    for (const [axis, properties] of Object.entries(AXIS_PROPERTIES)) {
      for (const property of properties) {
        expect({ property, axis: axisOf(property) }).toEqual({ property, axis });
        expect({ property, axis: axisOf(toCamelCase(property)) }).toEqual({ property, axis });
      }
    }
  });

  it('claims no property twice', () => {
    const seen = new Set();
    for (const properties of Object.values(AXIS_PROPERTIES)) {
      for (const property of properties) {
        expect(seen.has(property)).toBe(false);
        seen.add(property);
      }
    }
  });

  it('returns null for a property no axis owns', () => {
    for (const property of ['width', 'padding', 'font-size', 'margin-top', 'z-index']) {
      expect(axisOf(property)).toBe(null);
      expect(axisOf(toCamelCase(property))).toBe(null);
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
