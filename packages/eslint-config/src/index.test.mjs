// Deliberately bad fixtures. Each constraint the config claims to cover gets a
// case that must be flagged and a neighbouring case that must not be — a rule
// that fires on everything trains people to disable it.

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import cssModule from '@eslint/css';

import { designSystem } from './index.mjs';
import { designSystemCss } from './css.mjs';

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
  function lintCss(code, { filename = 'src/app/app.css', options } = {}) {
    return linter.verify(code, designSystemCss(options), filename);
  }

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
