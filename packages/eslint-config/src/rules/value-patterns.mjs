// What counts as a hardcoded *value*, defined once for both rules.
//
// no-hardcoded-design-values (JS/JSX) and no-hardcoded-css-values (CSS) ask the
// same question of a value string — is this a literal, or does it point at a
// token? — and differ only in how they reach the string. They previously each
// carried their own copy of these definitions and drifted apart: `color(...)`
// was flagged in a style object and ignored in a stylesheet.
//
// A value here always means the right-hand side: `#0f172a`, `0 4px 12px
// rgba(0,0,0,.1)`, the inside of a Tailwind arbitrary value. Which *property*
// belongs to which axis is a separate question — `boxShadow` vs `box-shadow` —
// and each rule still answers it for its own language, so those lists can still
// drift. Shared here is the value half only.

/** `#fff`, `#0f172a`, `#0f172aff` — and the 4-digit shorthand. */
export const HEX_COLOR = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i;

/**
 * Every CSS colour function, `color()` included — `color(display-p3 1 0 0)` is
 * as much a hardcoded colour as `#f00` is.
 */
export const COLOR_FUNCTIONS = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lch|lab|color)\s*\(/i;

/** A magic length: a bare number with a unit, no token behind it. */
export const MAGIC_LENGTH = /(?:^|[\s(,])\d*\.?\d+(?:px|rem|em)\b/;

/** A magic time: `200ms`, `.2s`. */
export const MAGIC_DURATION = /(?:^|[\s(,])\d*\.?\d+m?s\b/;

// Whole-value keywords that express "no value" or "whatever the cascade says".
// `inherit`, `initial`, `unset` and `revert` are the four CSS-wide keywords —
// all of them are equally valid in a stylesheet and in a style object, which
// sets real CSS. `0` and `0px` are zero either way, and zero is not a design
// decision anyone can take a token for.
const TRIVIAL_VALUE = /^(?:0|0px|none|inherit|initial|unset|revert|currentcolor|transparent)$/i;

/**
 * A value that already points at a token, or is too trivial to be a decision.
 *
 * `var(--x)` is a token reference, and so is Tailwind's `theme(...)`, which
 * resolves against the same scale in a JSX arbitrary value and in the
 * Tailwind-processed stylesheet this rule is pointed at.
 *
 * Both are matched anywhere in the value, not just as the whole of it, so one
 * token reference exempts the whole declaration — `0 1px 2px var(--shadow-hue)`
 * passes despite the `1px`. That is deliberate: a compound value is usually
 * part token, part unavoidable geometry, and reporting it would train people to
 * disable the rule. `theme(...)` gets the same treatment for the same reason.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isExempt(value) {
  return value.includes('var(--') || value.includes('theme(') || TRIVIAL_VALUE.test(value.trim());
}
