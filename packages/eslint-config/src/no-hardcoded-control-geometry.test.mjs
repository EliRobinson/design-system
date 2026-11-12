import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { lint, lintCss, messagesOf, rulesOf } from './lint.test-helper.mjs';
import {
  FOCUS_RING_PX,
  TOUCH_TARGET_PX,
  withoutTokenReferences,
} from './rules/no-hardcoded-control-geometry.mjs';

// The raw values #330 took out of the react CSS: a 44px touch target and a 2px
// focus ring. Each has a token now, so a literal is a regression waiting to
// happen, in our components and in a consumer's. They are their own rule
// rather than two more axes of no-hardcoded-design-values so they can ship as
// a warning; the rule's header says why.
const GEOMETRY = 'no-hardcoded-control-geometry';
const geometryOf = (results) => results.filter((result) => result.ruleId?.endsWith(GEOMETRY));

describe('no-hardcoded-control-geometry', () => {
  it.each([
    {
      what: 'a 44px min-height is a touch target',
      js: '<div style={{ minHeight: "44px" }} />',
      css: 'a { min-height: 44px; }',
      flagged: 'var(--target)',
    },
    {
      what: 'a 44px min-width is a touch target',
      js: '<div style={{ minWidth: "44px" }} />',
      css: 'a { min-width: 44px; }',
      flagged: 'var(--target)',
    },
    {
      what: 'a 44px height is a touch target',
      js: '<div style={{ height: "44px" }} />',
      css: 'a { height: 44px; }',
      flagged: 'var(--target)',
    },
    {
      what: 'a 44px width is a touch target',
      js: '<div style={{ width: "44px" }} />',
      css: 'a { width: 44px; }',
      flagged: 'var(--target)',
    },
    {
      what: 'a logical size is the same decision as a physical one',
      js: '<div style={{ minBlockSize: "44px" }} />',
      css: 'a { min-block-size: 44px; }',
      flagged: 'var(--target)',
    },
    {
      // A token elsewhere in the value does not excuse the literal: this is
      // the exact shape the old focus styles had.
      what: 'a 2px outline width is a focus ring, even beside a token colour',
      js: '<div style={{ outline: "2px solid var(--focus-ring)" }} />',
      css: 'a { outline: 2px solid var(--focus-ring); }',
      flagged: 'focus ring tokens',
    },
    {
      what: 'a 2px outline-width is a focus ring',
      js: '<div style={{ outlineWidth: "2px" }} />',
      css: 'a { outline-width: 2px; }',
      flagged: 'focus ring tokens',
    },
    {
      what: 'a 2px outline-offset is a focus ring',
      js: '<div style={{ outlineOffset: "2px" }} />',
      css: 'a { outline-offset: 2px; }',
      flagged: 'focus ring tokens',
    },
    {
      what: 'an inset ring is the same offset, negated',
      js: '<div style={{ outlineOffset: "-2px" }} />',
      css: 'a { outline-offset: -2px; }',
      flagged: 'focus ring tokens',
    },
    {
      what: 'a unit is case-insensitive',
      js: '<div style={{ minHeight: "44PX" }} />',
      css: 'a { min-height: 44PX; }',
      flagged: 'var(--target)',
    },
    {
      what: 'the target token',
      js: '<div style={{ minHeight: "var(--target)" }} />',
      css: 'a { min-height: var(--target); }',
      flagged: null,
    },
    {
      // react CSS writes the fallback out; it is the token's own value.
      what: 'a literal that is only a var() fallback',
      js: '<div style={{ outline: "var(--focus-ring-width, 2px) solid var(--focus-ring)" }} />',
      css: 'a { outline: var(--focus-ring-width, 2px) solid var(--focus-ring); }',
      flagged: null,
    },
    {
      what: 'the offset token, fallback and all',
      js: '<div style={{ outlineOffset: "var(--focus-ring-offset, 2px)" }} />',
      css: 'a { outline-offset: var(--focus-ring-offset, 2px); }',
      flagged: null,
    },
    {
      what: 'a fallback that is itself a function call',
      js: '<div style={{ minHeight: "var(--target, max(44px, 1em))" }} />',
      css: 'a { min-height: var(--target, max(44px, 1em)); }',
      flagged: null,
    },
    {
      what: 'a 1px forced-colors outline is not a focus ring',
      js: '<div style={{ outline: "1px solid CanvasText" }} />',
      css: 'a { outline: 1px solid CanvasText; }',
      flagged: null,
    },
    {
      what: 'a size that is not a target size',
      js: '<div style={{ width: "40px", height: "24px" }} />',
      css: 'a { width: 40px; height: 24px; }',
      flagged: null,
    },
    {
      what: '144px is not 44px',
      js: '<div style={{ width: "144px" }} />',
      css: 'a { width: 144px; }',
      flagged: null,
    },
    {
      what: 'a property off both axes',
      js: '<div style={{ padding: "44px", borderWidth: "2px" }} />',
      css: 'a { padding: 44px; border-width: 2px; }',
      flagged: null,
    },
  ])('$what', ({ js, css, flagged }) => {
    const jsResults = geometryOf(lint(`export const A = () => (${js})`));
    const cssResults = geometryOf(lintCss(css));

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

  it('reads a unitless number in a style object as the px React renders', () => {
    const results = geometryOf(
      lint('export const A = () => <div style={{ minHeight: 44, outlineOffset: 2 }} />'),
    );

    expect(results).toHaveLength(2);
  });

  it('leaves a number outside a style attribute alone, a DOMRect mock say', () => {
    expect(
      geometryOf(lint('export const rect = { top: 0, left: 0, width: 60, height: 44 }')),
    ).toEqual([]);
  });

  it.each([
    ['var(--a, var(--b, 2px)) solid', '  solid'],
    ['2px solid var(--focus-ring)', '2px solid  '],
    ['calc(var(--x, max(44px, 1em)) * 2)', 'calc(  * 2)'],
    ['theme(--spacing-11) 44px', '  44px'],
  ])('withoutTokenReferences(%j)', (value, expected) => {
    expect(withoutTokenReferences(value)).toBe(expected);
  });

  it('tells an inset ring how to stay inset', () => {
    const [result] = lintCss('a { outline-offset: -2px; }');
    expect(result.message).toContain('calc(var(--focus-ring-width) * -1)');
  });

  it('looks for the values the tokens actually have', () => {
    const tokens = readFileSync(
      fileURLToPath(new URL('../../tokens/src/tokens.css', import.meta.url)),
      'utf8',
    );
    const px = (name) => Number(tokens.match(new RegExp(`${name}:\\s*(\\d+)px`))?.[1]);

    expect(px('--target')).toBe(TOUCH_TARGET_PX);
    expect(px('--focus-ring-width')).toBe(FOCUS_RING_PX);
    expect(px('--focus-ring-offset')).toBe(FOCUS_RING_PX);
  });

  it('does not double-report as no-hardcoded-design-values', () => {
    expect(rulesOf(lintCss('a { min-height: 44px; }'))).toEqual([`@elirobinson-css/${GEOMETRY}`]);
    expect(rulesOf(lint('export const A = () => <div style={{ minHeight: "44px" }} />'))).toEqual([
      `@elirobinson/${GEOMETRY}`,
    ]);
  });

  it('ships as a warning in both configs, whatever `severity` says', () => {
    const [js] = lint('export const A = () => <div style={{ minHeight: "44px" }} />', {
      options: { severity: 'error' },
    });
    const [css] = lintCss('a { min-height: 44px; }', { options: { severity: 'error' } });

    expect(js.severity).toBe(1);
    expect(css.severity).toBe(1);
  });

  it('can be raised to an error', () => {
    const [js] = lint('export const A = () => <div style={{ minHeight: "44px" }} />', {
      options: { controlGeometry: { severity: 'error' } },
    });
    const [css] = lintCss('a { min-height: 44px; }', {
      options: { controlGeometry: { severity: 'error' } },
    });

    expect(js.severity).toBe(2);
    expect(css.severity).toBe(2);
  });
});

// #391: a Tailwind arbitrary value is a literal too, and for a Tailwind
// consumer it is the likeliest spelling of both. Scale utilities (`min-h-11`,
// `outline-2`) are not literals and stay out of it.
describe('no-hardcoded-control-geometry in Tailwind classes', () => {
  /** Lints one JSX expression and keeps only this rule's findings. */
  const lintJsx = (code, options) =>
    geometryOf(lint(`export const A = () => (${code})`, { options }));

  it.each([
    ['min-h-[44px]', 'var(--target)'],
    ['min-w-[44px]', 'var(--target)'],
    ['h-[44px]', 'var(--target)'],
    ['w-[44px]', 'var(--target)'],
    ['size-[44px]', 'var(--target)'],
    ['outline-[2px]', 'focus ring tokens'],
    ['outline-offset-[2px]', 'focus ring tokens'],
    // A negative utility is the inset ring, spelled the Tailwind way.
    ['-outline-offset-[2px]', 'focus ring tokens'],
    ['outline-offset-[-2px]', 'focus ring tokens'],
    ['focus-visible:outline-[2px]', 'focus ring tokens'],
    ['[&_svg]:size-[44px]', 'var(--target)'],
    ['min-h-[44PX]', 'var(--target)'],
    ['outline-[2px_solid_var(--focus-ring)]', 'focus ring tokens'],
    // A type hint tells Tailwind what the value is; it is still the value.
    ['outline-[length:2px]', 'focus ring tokens'],
    // An arbitrary property is the CSS declaration itself.
    ['[min-height:44px]', 'var(--target)'],
    ['[outline-width:2px]', 'focus ring tokens'],
  ])('flags %s', (className, flagged) => {
    const results = lintJsx(`<div className="flex ${className}" />`);

    expect(messagesOf(results)).toHaveLength(1);
    expect(results[0].message).toContain(flagged);
    expect(results[0].message).toContain(
      `in \`${className.replace(/^(?:[\w-]+|\[[^\]]*\]):/, '')}\``,
    );
  });

  it('reports the same message a style object gets', () => {
    const [fromClass] = lintJsx('<div className="min-h-[44px]" />');
    const [fromStyle] = lintJsx('<div style={{ minHeight: "44px" }} />');

    expect(fromClass.message.replace(/`[^`]*`/, '')).toBe(fromStyle.message.replace(/`[^`]*`/, ''));
  });

  it.each([
    'min-h-[var(--target)]',
    'size-[var(--target-min)]',
    'outline-[var(--focus-ring-width)]',
    'outline-offset-[var(--focus-ring-offset,2px)]',
    'min-h-target',
    'min-h-11',
    'outline-2',
    'outline-offset-2',
    'w-[144px]',
    'h-[24px]',
    'p-[44px]',
    'border-[2px]',
    'outline-[1px]',
    'max-h-[44px]',
    '[min-height:var(--target)]',
    '[padding:44px]',
  ])('leaves %s alone', (className) => {
    expect(lintJsx(`<div className="${className}" />`)).toEqual([]);
  });

  it.each([
    ['cn', 'cn("flex", "min-h-[44px]")'],
    ['clsx', 'clsx({ "min-h-[44px]": true })'],
    ['classnames', 'classnames("min-h-[44px]")'],
    ['classNames', 'classNames("min-h-[44px]")'],
    ['twMerge', 'twMerge("min-h-[44px]")'],
    ['a member call', 'utils.cn("min-h-[44px]")'],
    ['a conditional', 'cn(open ? "min-h-[44px]" : "min-h-0")'],
    ['an object key behind &&', 'cn(open && { "min-h-[44px]": x })'],
    ['an object key in a conditional', 'cn(open ? { "min-h-[44px]": x } : null)'],
    ['an object key in an array', 'clsx([{ "min-h-[44px]": x }])'],
  ])('reads %s inside className', (_, call) => {
    expect(lintJsx(`<div className={${call}} />`)).toHaveLength(1);
  });

  it('reads cva variants outside JSX', () => {
    const results = geometryOf(
      lint(
        'export const button = cva("inline-flex", { variants: { size: { md: "min-h-[44px]" }, width: { lg: "w-[44px]" } } })',
      ),
    );

    expect(results).toHaveLength(2);
  });

  it('reads a template literal and the class attribute', () => {
    expect(lintJsx('<div className={`flex ${x} min-h-[44px]`} />')).toHaveLength(1);
    expect(lintJsx('<div class="outline-[2px]" />')).toHaveLength(1);
  });

  it('reports a class reached through both the attribute and a call once', () => {
    expect(lintJsx('<div className={cn("min-h-[44px]")} />')).toHaveLength(1);
  });

  it('leaves a function that is not a class-name helper alone', () => {
    expect(lintJsx('<div title={format("min-h-[44px]")} />')).toEqual([]);
  });

  it('follows hardcodedValues.classNameFunctions', () => {
    const code = '<div className={tw("min-h-[44px]")} />';

    expect(lintJsx(code)).toEqual([]);
    expect(lintJsx(code, { hardcodedValues: { classNameFunctions: ['tw'] } })).toHaveLength(1);
  });

  it('can be turned off', () => {
    expect(
      lintJsx('<div className="min-h-[44px]" />', { controlGeometry: { severity: 'off' } }),
    ).toEqual([]);
  });

  it('is still a warning', () => {
    const [result] = lintJsx('<div className="min-h-[44px]" />', { severity: 'error' });
    expect(result.severity).toBe(1);
  });
});
