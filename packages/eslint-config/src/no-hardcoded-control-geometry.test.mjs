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
describe('no-hardcoded-control-geometry', () => {
  const GEOMETRY = 'no-hardcoded-control-geometry';
  const geometryOf = (results) => results.filter((result) => result.ruleId?.endsWith(GEOMETRY));

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
