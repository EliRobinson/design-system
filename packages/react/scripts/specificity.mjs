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
