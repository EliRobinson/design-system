/* One list of dense affordances, written down twice.
 *
 * `DENSE_AFFORDANCE_SELECTOR` decides which controls checkTouchTargets()
 * measures against 24x24 instead of 44x44. tokens.css's mobile touch-target
 * floor excludes the same set, so that a control the contract measures at 24 is
 * not simultaneously stretched to 44 on a phone. The two have to name the same
 * classes, and they cannot share a definition: one is JavaScript and the other
 * is a stylesheet a browser parses directly.
 *
 * So the invariant is pinned here instead. Adding a class to one list and not
 * the other is a silent, specific bug — a dense control floored to 44px on a
 * phone while the contract measures it at 24, which is exactly the disagreement
 * both files' comments are about — and it is not visible from either file
 * alone. This is the file that sees both.
 *
 * Reading the shipped stylesheet rather than a copy: @elirobinson/tokens is a
 * devDependency here and resolves through its export map, so this fails if the
 * published stylesheet drifts, not merely if a source file does.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { DENSE_AFFORDANCE_SELECTOR } from './playwright.mjs';

const resolveFrom = createRequire(import.meta.url);
const tokensCss = readFileSync(resolveFrom.resolve('@elirobinson/tokens/tokens.css'), 'utf8');

/* Every `:not(:where(…))` exclusion in the stylesheet. The floor writes its
   exclusion that way precisely so it carries no specificity, which also makes
   it the one construct to look for — a bare `:not()` somewhere else in the file
   cannot be confused for it.

   Comments are stripped first, and that is not a nicety: tokens.css explains
   this exact construct in prose directly above the rule, so a scanner reading
   raw bytes finds the sentence before it finds the selector. That is #123
   exactly — the brand manifest scanners had the same bug — and it fails in the
   most misleading way available, by reporting a list that is real text from the
   file. */
function exclusionLists(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const lists = [];
  const marker = ':not(';
  let from = 0;

  for (;;) {
    const start = css.indexOf(marker, from);
    if (start === -1) break;
    from = start + marker.length;

    /* Balance the parens by hand: the list contains `:where(…)`, so a
       non-greedy regex would stop at the first `)`. */
    let depth = 1;
    let i = from;
    while (i < css.length && depth > 0) {
      if (css[i] === '(') depth += 1;
      else if (css[i] === ')') depth -= 1;
      i += 1;
    }
    const inner = css.slice(from, i - 1).trim();
    if (!inner.startsWith(':where(')) continue;

    lists.push(inner.slice(':where('.length, -1).split(',').map(normalise).filter(Boolean));
  }

  return lists;
}

/* Prettier formats the stylesheet with single quotes and this module with
   double ones, so `[data-touch-target='dense']` and `[data-touch-target="dense"]`
   are the same selector written two ways. Normalising is not loosening the
   check — CSS attribute-selector quoting carries no meaning — and the
   alternative is a test that fails whenever a formatter runs. */
const normalise = (entry) => entry.trim().replace(/'/g, '"');

const parts = (selector) => selector.split(',').map(normalise).filter(Boolean);

describe('the dense affordance list', () => {
  const lists = exclusionLists(tokensCss);

  it('is excluded from both halves of the mobile floor', () => {
    /* Two, not one: the attribute half and the media-query half. A change that
       updates only one of them is the original defect in a new costume. */
    expect(lists).toHaveLength(2);
  });

  it('names exactly the selectors checkTouchTargets() measures at the dense floor', () => {
    const expected = parts(DENSE_AFFORDANCE_SELECTOR);

    /* Sorted, because the cascade does not care about order within a `:not()`
       and neither does `closest`. Order-sensitivity here would make this fail
       for a reason that is not a bug. */
    for (const list of lists) {
      expect([...list].sort()).toEqual([...expected].sort());
    }
  });

  it('keeps the two halves identical to each other', () => {
    expect(lists[0]).toEqual(lists[1]);
  });
});
