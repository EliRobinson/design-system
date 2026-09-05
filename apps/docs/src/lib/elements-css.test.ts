import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/* app/elements.css is loaded from the ROOT layout, so everything it pulls in
   applies to all 95 routes — including /patterns/*, the chrome shots, and
   every page written long before Tailwind arrived here.
 *
 * That is how #228's regression happened: `@import 'tailwindcss'` carries
 * Preflight, Preflight flattened every heading and unmarked every list on the
 * site, and 176 of 692 visual comparisons went red on pages the branch never
 * touched. Nothing local caught it — the docs build is silent about it, and
 * scripts:test compares the LIST of shots rather than pixels.
 *
 * These four tests are the local check that was missing. They are text
 * assertions on two stylesheets rather than rendering assertions, which is the
 * point: they run in milliseconds and they fail on the three properties that
 * actually matter — what is imported, how far it reaches, and where in the
 * cascade it lands. */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const ELEMENTS_CSS = read('src/app/elements.css');
const SCOPED_PREFLIGHT = read('src/app/preflight-scoped.css');
const UPSTREAM_PREFLIGHT = read('node_modules/tailwindcss/preflight.css');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/* Both files quote the very selectors and imports being asserted on, so every
   assertion reads them with comments removed. Matching against the raw text
   passes or fails on a paragraph of prose. */
const DECLARED = stripComments(ELEMENTS_CSS);
const SCOPED = stripComments(SCOPED_PREFLIGHT);

/** Split a selector list on its top-level commas — `:is(a, b)` holds none. */
function selectorParts(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let part = '';
  for (const char of selector) {
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(part.trim());
      part = '';
    } else part += char;
  }
  if (part.trim()) parts.push(part.trim());
  return parts;
}

/** Selector lists of every rule in a flat stylesheet, `@supports` included. */
function selectorGroups(css: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let head = '';
  for (const char of stripComments(css)) {
    if (char === '{') {
      const selector = head.trim().replace(/\s+/g, ' ');
      /* An at-rule opens a block whose contents are rules in their own right,
         so it contributes no selector and its body is read at the next depth
         rather than skipped. */
      if (selector && !selector.startsWith('@')) groups.push(selector);
      head = '';
      depth += 1;
    } else if (char === '}') {
      head = '';
      depth -= 1;
    } else head += char;
  }
  expect(depth).toBe(0);
  return groups;
}

describe('app/elements.css', () => {
  it('imports Tailwind without Preflight', () => {
    /* The bare specifier is the whole bug. `tailwindcss/theme.css` and
       `tailwindcss/utilities.css` are two thirds of what it expands to; the
       third is `tailwindcss/preflight.css`, which must never be imported here
       at any layer, because this file is global. */
    expect(DECLARED).not.toMatch(/@import\s+['"]tailwindcss['"]/);
    expect(DECLARED).not.toMatch(/@import\s+['"]tailwindcss\/preflight/);
    expect(DECLARED).toMatch(/@import\s+'tailwindcss\/theme\.css'\s+layer\(theme\)/);
    expect(DECLARED).toMatch(/@import\s+'tailwindcss\/utilities\.css'\s+layer\(utilities\)/);
    expect(DECLARED).toMatch(/@import\s+'\.\/preflight-scoped\.css'\s+layer\(base\)/);
  });

  it('keeps the scoped reset where Preflight sat in the cascade', () => {
    /* Within `@layer base` the later rule wins at equal specificity, so this
       ordering is not cosmetic: it is what still lets tokens.css's `a` rule
       beat the reset, exactly as it does for a consumer whose entry stylesheet
       opens with `@import 'tailwindcss'`. Import the scoped copy after the
       tokens and it wins instead — measured on /fixtures/ai-elements/sources,
       where the source links lost their underline. */
    const at = (needle: string) => {
      const index = DECLARED.indexOf(needle);
      expect(index, `${needle} not found in elements.css`).toBeGreaterThan(-1);
      return index;
    };
    expect(at('@layer theme, base, components, utilities;')).toBeLessThan(at('@import'));
    expect(at("@import 'tailwindcss/theme.css'")).toBeLessThan(at("@import './preflight-scoped"));
    expect(at("@import './preflight-scoped")).toBeLessThan(at("@import '@elirobinson/tokens"));
  });

  it('reaches nothing outside a demo stage, and adds no specificity', () => {
    /* Two invariants, and a rule that breaks either one is a site-wide change
       wearing a local disguise.

       REACH: every selector is qualified by the one class the two surfaces
       that mount a vendored component carry. Without it the rule is site-wide,
       and site-wide is what broke /patterns/hero and /chrome/footer.

       WEIGHT: the qualifier is spelled `:where(.fixture-stage)`, which
       contributes zero specificity, so each rule keeps exactly the weight
       upstream gave it. A bare `.fixture-stage` prefix would raise every rule
       by a class and silently win fights preflight was designed to lose. */
    const offenders = selectorGroups(SCOPED).filter((selector) =>
      selectorParts(selector).some((part) => !part.includes(':where(.fixture-stage)')),
    );
    expect(offenders).toEqual([]);
    expect(SCOPED).not.toMatch(/(^|[\s,>+~])\.fixture-stage/m);

    /* And the reset is all this file is. Anything else belongs in site.css. */
    expect(DECLARED).not.toContain('{');
  });

  it('reproduces every rule of the Tailwind version it was derived from', () => {
    /* The scoped reset is a copy, and a copy drifts. This reads upstream's
       preflight.css out of node_modules and asserts two things: that its rule
       set is still the one the copy was written against, and that each of
       those rules has a scoped counterpart.
     *
       A Tailwind bump that adds, drops or renames a preflight rule fails here
       with the selector named, which is the moment to re-derive the copy —
       rather than six months later, as a demo that is quietly half-reset. */
    const upstream = selectorGroups(UPSTREAM_PREFLIGHT);

    /* Recorded against tailwindcss@4.3.3. */
    expect(upstream).toEqual([
      '*, ::after, ::before, ::backdrop, ::file-selector-button',
      'html, :host',
      'hr',
      'abbr:where([title])',
      'h1, h2, h3, h4, h5, h6',
      'a',
      'b, strong',
      'code, kbd, samp, pre',
      'small',
      'sub, sup',
      'sub',
      'sup',
      'table',
      ':-moz-focusring:where(:not(iframe))',
      'progress',
      'summary',
      'ol, ul, menu',
      'img, svg, video, canvas, audio, iframe, embed, object',
      'img, video',
      'button, input, select, optgroup, textarea, ::file-selector-button',
      ':where(select:is([multiple], [size])) optgroup',
      ':where(select:is([multiple], [size])) optgroup option',
      '::file-selector-button',
      '::placeholder',
      '::placeholder',
      'textarea',
      '::-webkit-search-decoration',
      '::-webkit-date-and-time-value',
      '::-webkit-datetime-edit',
      '::-webkit-datetime-edit-fields-wrapper',
      '::-webkit-datetime-edit, ::-webkit-datetime-edit-year-field, ::-webkit-datetime-edit-month-field, ::-webkit-datetime-edit-day-field, ::-webkit-datetime-edit-hour-field, ::-webkit-datetime-edit-minute-field, ::-webkit-datetime-edit-second-field, ::-webkit-datetime-edit-millisecond-field, ::-webkit-datetime-edit-meridiem-field',
      '::-webkit-calendar-picker-indicator',
      ':-moz-ui-invalid',
      "button, input:where([type='button'], [type='reset'], [type='submit']), ::file-selector-button",
      '::-webkit-inner-spin-button, ::-webkit-outer-spin-button',
      "[hidden]:where(:not([hidden='until-found']))",
    ]);

    /* `html, :host` is the one rule deliberately not reproduced — see the
       comment at the top of preflight-scoped.css for why. */
    const OMITTED = new Set(['html, :host']);

    const scoped = SCOPED.replace(/\s+/g, ' ');
    const missing = upstream
      .filter((group) => !OMITTED.has(group))
      /* The last comma-part is the group's most distinctive selector, and
         checking one part per group catches a rule that was dropped or renamed
         without re-implementing a CSS matcher here. */
      .map((group) => `:where(.fixture-stage) ${selectorParts(group).pop()!}`)
      .filter((selector) => !scoped.includes(selector));
    expect(missing).toEqual([]);
  });
});
