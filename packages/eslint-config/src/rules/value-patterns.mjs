// What counts as a hardcoded *value*, defined once for both rules.
//
// no-hardcoded-design-values (JS/JSX) and no-hardcoded-css-values (CSS) ask the
// same question of a value string — is this a literal, or does it point at a
// token? — and differ only in how they reach the string. They previously each
// carried their own copy of these definitions and drifted apart: `color(...)`
// was flagged in a style object and ignored in a stylesheet.
//
// A value here always means the right-hand side: `#0f172a`, `0 4px 12px
// rgba(0,0,0,.1)`, the inside of a Tailwind arbitrary value.
//
// Which *property* belongs to which axis is shared here too, further down. That
// half had drifted the same way: `filter: drop-shadow(...)` was an error in a
// style object and silent in a stylesheet. A property now has exactly one axis,
// written once in camelCase, with the kebab-case spelling derived from it.

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

// --- Which property belongs to which axis -----------------------------------
//
// One table, four axes, every property listed exactly once. Building the
// lookups from it throws on a property listed twice, so "exactly one axis" is a
// property of the data structure rather than something to remember.
//
// Properties are written in the JS spelling because it is the one that cannot be
// derived: `border-top-left-radius` -> `borderTopLeftRadius` needs to know where
// the words are, while the reverse is a mechanical transform. The CSS spelling
// is generated, so the two languages cannot list different properties.

/**
 * `filter` and `backdropFilter` accept a dozen functions and only one of them is
 * a shadow. Guarding on the value keeps `filter: blur(4px)` off the shadow axis
 * — it is a real length, but "use a shadow token" is not the advice for it.
 */
const DROP_SHADOW = /\bdrop-shadow\s*\(/i;

/**
 * @typedef {object} Axis
 * @property {string} name
 * @property {string} messageId  Which of the rule's four messages to report.
 * @property {(value: string) => boolean} matches  Is this value a literal on this axis?
 * @property {(value: string) => string} highlight  The part of the value worth naming.
 */

const IDENTITY = (value) => value;

const AXIS_DEFINITIONS = {
  color: {
    messageId: 'color',
    matches: (value) => HEX_COLOR.test(value) || COLOR_FUNCTIONS.test(value),
    // Name the literal rather than the whole declaration, so `allow: ['#ff0000']`
    // keeps matching a colour buried in a compound value.
    highlight: (value) => value.match(HEX_COLOR)?.[0] ?? value.trim(),
    properties: [
      'color',
      'backgroundColor',
      'background',
      'borderColor',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
      // The logical longhands are the same decision as the physical ones.
      'borderBlockColor',
      'borderBlockStartColor',
      'borderBlockEndColor',
      'borderInlineColor',
      'borderInlineStartColor',
      'borderInlineEndColor',
      'outlineColor',
      'textDecorationColor',
      'caretColor',
      'accentColor',
      'columnRuleColor',
      'fill',
      'stroke',
    ],
  },

  radius: {
    messageId: 'radius',
    matches: (value) => MAGIC_LENGTH.test(value),
    highlight: IDENTITY,
    properties: [
      'borderRadius',
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderBottomLeftRadius',
      'borderBottomRightRadius',
      'borderStartStartRadius',
      'borderStartEndRadius',
      'borderEndStartRadius',
      'borderEndEndRadius',
    ],
  },

  shadow: {
    messageId: 'shadow',
    // A shadow is a shadow whatever kind of literal it carries: `0 0 rgb(...)`
    // has no magic length in it and is still a hardcoded shadow. Because a
    // property has one axis, this cannot double-report as a colour.
    matches: (value) =>
      MAGIC_LENGTH.test(value) || HEX_COLOR.test(value) || COLOR_FUNCTIONS.test(value),
    highlight: IDENTITY,
    properties: [
      'boxShadow',
      'textShadow',
      ['filter', DROP_SHADOW],
      ['backdropFilter', DROP_SHADOW],
    ],
  },

  motion: {
    messageId: 'duration',
    matches: (value) => MAGIC_DURATION.test(value) || value.includes('cubic-bezier'),
    highlight: IDENTITY,
    properties: [
      'transition',
      'transitionDuration',
      'transitionTimingFunction',
      'animation',
      'animationDuration',
      'animationTimingFunction',
    ],
  },
};

/** `borderTopLeftRadius` -> `border-top-left-radius`. */
function kebabCase(property) {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const BY_JS_PROPERTY = new Map();
const BY_CSS_PROPERTY = new Map();

/** @type {ReadonlyArray<{ js: string, css: string, axis: string }>} */
export const DESIGN_PROPERTIES = Object.freeze(
  Object.entries(AXIS_DEFINITIONS).flatMap(([name, definition]) =>
    definition.properties.map((entry) => {
      const [js, guard] = Array.isArray(entry) ? entry : [entry, null];

      if (BY_JS_PROPERTY.has(js)) {
        throw new Error(`${js} is listed on more than one axis; a property has exactly one.`);
      }

      /** @type {Axis} */
      const axis = {
        name,
        messageId: definition.messageId,
        matches: guard
          ? (value) => guard.test(value) && definition.matches(value)
          : definition.matches,
        highlight: definition.highlight,
      };

      const css = kebabCase(js);
      BY_JS_PROPERTY.set(js, axis);
      BY_CSS_PROPERTY.set(css, axis);

      return Object.freeze({ js, css, axis: name });
    }),
  ),
);

/**
 * The axis a style-object property sits on, or null if the rules ignore it.
 *
 * @param {string} property camelCase, as written in a style object.
 * @returns {Axis | null}
 */
export function axisForJsProperty(property) {
  return BY_JS_PROPERTY.get(property) ?? null;
}

/**
 * The axis a CSS declaration's property sits on, or null if the rules ignore it.
 *
 * @param {string} property kebab-case, as written in a stylesheet.
 * @returns {Axis | null}
 */
export function axisForCssProperty(property) {
  return BY_CSS_PROPERTY.get(property) ?? null;
}
