/* CSS specificity, for the tests that have to resolve a cascade by hand.
 *
 * There is no DOM API that exposes specificity, so any test that asks "which
 * declaration actually wins" has to compute it. Two do — button-contrast
 * resolves `color`, control-affordance resolves the underline — and a second
 * copy of this arithmetic is how the two would come to disagree about which
 * rule a browser picks.
 *
 * Kept out of a *.test.mjs file on purpose: importing one test file from
 * another registers its suites twice.
 */

/**
 * CSS specificity as [id, class, element].
 *
 * Pseudo-elements count as elements and pseudo-classes as classes, per
 * https://www.w3.org/TR/selectors-4/#specificity-rules. `:not()`/`:is()` take
 * the specificity of their most specific argument; neither appears in the
 * selectors these tests resolve, so they are not handled.
 *
 * @param {string} selector
 * @returns {[number, number, number]}
 */
export function specificity(selector) {
  let rest = selector;
  const take = (pattern) => {
    const found = rest.match(pattern) ?? [];
    rest = rest.replace(pattern, ' ');
    return found.length;
  };
  const ids = take(/#[\w-]+/g);
  const pseudoElements = take(/::[\w-]+/g);
  const attributes = take(/\[[^\]]*\]/g);
  const pseudoClasses = take(/:[\w-]+(\([^)]*\))?/g);
  const classes = take(/\.[\w-]+/g);
  const elements = (rest.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return [ids, classes + attributes + pseudoClasses, elements + pseudoElements];
}

/** Sort comparator for two specificity triples. */
export const compareSpecificity = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Every style rule in `sheets`, flattened out of any cascade layer it sits in
 * and tagged with whether it was in one.
 *
 * `sheet.cssRules` is one level deep. tokens.css now puts its bare `a` rule in
 * `@layer base` (issue #112), which both jsdom and a browser expose as a
 * CSSLayerBlockRule holding the real rules — so a resolver that iterated
 * `cssRules` directly stopped seeing `a` at all, and reported "nothing sets a
 * text-decoration" rather than the truth.
 *
 * @param {Iterable<CSSStyleSheet>} sheets
 * @returns {Generator<{ rule: CSSStyleRule, layered: boolean }>}
 */
export function* styleRules(sheets) {
  for (const sheet of sheets) yield* rulesIn(sheet.cssRules, false);
}

function* rulesIn(rules, layered) {
  for (const rule of rules) {
    if (rule.cssRules && /^@layer\b/.test(rule.cssText ?? '')) {
      yield* rulesIn(rule.cssRules, true);
    } else if (rule.selectorText && rule.style) {
      yield { rule, layered };
    }
  }
}

/**
 * Which of two candidate declarations a browser picks. Positive when `a` wins.
 *
 * Layer beats specificity, and it is not a tie-breaker in the same series: an
 * UNLAYERED declaration wins over a layered one however specific the layered
 * one is. That is the whole mechanism issue #112 turned on, and a comparator
 * that only knew specificity would now get `a:hover` (0,1,1) vs
 * `.ds-button--accent` (0,1,0) exactly backwards.
 *
 * @param {{ layered: boolean, specificity: [number, number, number] }} a
 * @param {{ layered: boolean, specificity: [number, number, number] }} b
 */
export const compareCascade = (a, b) =>
  Number(b.layered) - Number(a.layered) || compareSpecificity(a.specificity, b.specificity);
