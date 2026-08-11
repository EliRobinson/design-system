// What counts as a hardcoded declaration, defined once for both rules.
//
// no-hardcoded-design-values (JS/JSX) and no-hardcoded-css-values (CSS) ask the
// same question of a declaration — is this a literal, or does it point at a
// token? — and differ only in how they reach it. They previously each carried
// their own copy of these definitions and drifted apart on both halves:
//
//   - the *value* half: `color(...)` was flagged in a style object and ignored
//     in a stylesheet;
//   - the *property* half: `filter: drop-shadow(...)` was an error in a .tsx
//     and silent in a .css, `column-rule-color` was a colour property in one
//     language only, and a colour-only `text-shadow` reported messageId
//     `shadow` in JS but `color` in CSS.
//
// Both halves now live here. A property reaches its axis through `axisOf`,
// which normalises either spelling — `boxShadow` and `box-shadow` are the same
// key — so the two languages cannot disagree about membership. The axis then
// picks the value test, which is what keeps the reported messageId stable:
// consumers pin ids in eslint-disable comments and severity overrides.

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

/**
 * Which properties belong to which axis, in CSS spelling. One property belongs
 * to exactly one axis: `box-shadow` is a shadow, never a colour, even when the
 * only literal in it is an `rgb()`. That exclusivity is what makes the reported
 * messageId predictable from the property alone.
 *
 * Logical properties sit alongside their physical counterparts throughout.
 * `border-start-start-radius` is as much a radius decision as
 * `border-top-left-radius`, and a list that covered one but not the other would
 * be reintroducing the drift this module exists to remove.
 */
export const AXIS_PROPERTIES = {
  color: [
    'color',
    'background',
    'background-color',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'border-block-color',
    'border-block-start-color',
    'border-block-end-color',
    'border-inline-color',
    'border-inline-start-color',
    'border-inline-end-color',
    'outline-color',
    'text-decoration-color',
    'caret-color',
    'accent-color',
    'column-rule-color',
    'fill',
    'stroke',
  ],
  radius: [
    'border-radius',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
    'border-start-start-radius',
    'border-start-end-radius',
    'border-end-start-radius',
    'border-end-end-radius',
  ],
  shadow: ['box-shadow', 'text-shadow', 'filter', 'backdrop-filter'],
  duration: [
    'transition',
    'transition-duration',
    'transition-timing-function',
    'animation',
    'animation-duration',
    'animation-timing-function',
  ],
};

const AXIS_BY_PROPERTY = new Map(
  Object.entries(AXIS_PROPERTIES).flatMap(([axis, properties]) =>
    properties.map((property) => [property, axis]),
  ),
);

/**
 * `filter` and `backdrop-filter` reach the shadow axis only through
 * `drop-shadow()`. They are the one axis member that is not wholly a design
 * decision: `filter: blur(4px)` is a magic length, but no shadow token can
 * replace it, and reporting it as a shadow points people at advice that cannot
 * apply. `filter: drop-shadow(0 4px 8px #000)` is a real hardcoded shadow.
 */
const SHADOW_BY_DROP_SHADOW_ONLY = new Set(['filter', 'backdrop-filter']);

const AXIS_TEST = {
  color: (value) => HEX_COLOR.test(value) || COLOR_FUNCTIONS.test(value),
  radius: (value) => MAGIC_LENGTH.test(value),
  // A shadow carries a colour inside it, so the shadow axis tests both — that
  // is what stops a colour-only `text-shadow` falling through to the colour
  // axis and reporting the less actionable message.
  shadow: (value) =>
    MAGIC_LENGTH.test(value) || HEX_COLOR.test(value) || COLOR_FUNCTIONS.test(value),
  duration: (value) => MAGIC_DURATION.test(value) || value.includes('cubic-bezier'),
};

/** `borderTopColor` -> `border-top-color`; already-kebab names pass through. */
export function toKebabCase(property) {
  return property.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** `border-top-color` -> `borderTopColor`; already-camel names pass through. */
export function toCamelCase(property) {
  return property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * The axis a property belongs to, in either spelling, or null if the design
 * system does not own it. Spacing and font size deliberately have no axis.
 *
 * @param {string} property
 * @returns {'color' | 'radius' | 'shadow' | 'duration' | null}
 */
export function axisOf(property) {
  return AXIS_BY_PROPERTY.get(toKebabCase(property)) ?? null;
}

/**
 * The messageId a declaration should report, or null if it is clean. This is
 * the whole judgement both rules make — they differ only in how they find the
 * property and value to hand it.
 *
 * @param {string} property camelCase or kebab-case
 * @param {string} value
 * @returns {'color' | 'radius' | 'shadow' | 'duration' | null}
 */
export function hardcodedAxis(property, value) {
  const axis = axisOf(property);
  if (!axis || isExempt(value)) return null;

  if (SHADOW_BY_DROP_SHADOW_ONLY.has(toKebabCase(property)) && !value.includes('drop-shadow(')) {
    return null;
  }

  return AXIS_TEST[axis](value) ? axis : null;
}
