// The two values #330 replaced with tokens in the component CSS: a 44px touch
// target (`--target`) and a 2px focus ring (`--focus-ring-width`,
// `--focus-ring-offset`). Spelled out, they stop following the tokens — the
// mobile floor, a palette that thickens its ring — and they come back easily,
// because 44 and 2 are the numbers everyone remembers.
//
// It is its own rule rather than two more axes of no-hardcoded-design-values
// only so it can ship as a warning: every app that predates the tokens has a
// `min-height: 44px` somewhere, and a rule that red-builds a consumer on
// upgrade gets deleted rather than worked through.
//
// One module, both languages, as no-duplicate-token-stylesheet does it: the
// style-object half is `jsRule`, the stylesheet half is `cssRule`, and they
// read the same table.
//
// Tailwind classes are read for their arbitrary values (`min-h-[44px]`), which
// are literals. Scale utilities (`min-h-11`, `outline-2`) are not, and are
// left alone.

import { jsxAttributeName, propertyName, staticStrings } from './ast-strings.mjs';
import {
  DEFAULT_CLASS_NAME_FUNCTIONS,
  arbitraryValues,
  classNameVisitors,
} from './class-names.mjs';
import { createCssRule } from './no-hardcoded-css-values.mjs';

/**
 * The token values this rule looks for, spelled out: `--target` and
 * `--focus-ring-width` / `--focus-ring-offset` in @elirobinson/tokens. A test
 * reads tokens.css and fails if either moves without these.
 */
export const TOUCH_TARGET_PX = 44;
export const FOCUS_RING_PX = 2;

/**
 * The value with every `var(...)` and `theme(...)` taken out, fallbacks and
 * all, nested parentheses included: `var(--x, max(44px, 1em))` leaves nothing.
 *
 * @param {string} value
 * @returns {string}
 */
export function withoutTokenReferences(value) {
  let out = '';
  let index = 0;
  const call = /\b(?:var|theme)\(/g;
  for (let match = call.exec(value); match; match = call.exec(value)) {
    if (match.index < index) continue;
    out += `${value.slice(index, match.index)} `;
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < value.length; end += 1) {
      if (value[end] === '(') depth += 1;
      else if (value[end] === ')' && --depth === 0) break;
    }
    index = end + 1;
    call.lastIndex = index;
  }
  return out + value.slice(index);
}

/**
 * Flags one length, signed or not, and nothing else: `44px` and `-2px`, but
 * not `144px`. Units are case-insensitive in CSS, so `44PX` too.
 *
 * Unlike no-hardcoded-design-values, a token reference elsewhere in the value
 * does not exempt it. `outline: 2px solid var(--focus-ring)` is exactly the
 * shape the old focus styles had, and the token in it is the colour, not the
 * width. So the literal is looked for in what is left once every var() and
 * theme() is taken out — which also lets a fallback, `var(--target, 44px)`,
 * through, because a fallback is the token's own value.
 */
function exactLengthAxis(messageId, px) {
  const literal = new RegExp(String.raw`(?:^|[\s(,])-?${px}px\b`, 'i');
  return {
    messageId,
    exempt: () => false,
    matches: (value) => literal.test(withoutTokenReferences(value)),
  };
}

const TARGET = exactLengthAxis('target', TOUCH_TARGET_PX);
const FOCUS_RING = exactLengthAxis('focusRing', FOCUS_RING_PX);

/** camelCase, as written in a style object; the CSS spelling is derived. */
const AXIS_BY_JS_PROPERTY = new Map([
  // The logical sizes are the same decision as the physical ones.
  ...[
    'minHeight',
    'minWidth',
    'height',
    'width',
    'minBlockSize',
    'minInlineSize',
    'blockSize',
    'inlineSize',
  ].map((property) => [property, TARGET]),
  ...['outline', 'outlineWidth', 'outlineOffset'].map((property) => [property, FOCUS_RING]),
]);

const AXIS_BY_CSS_PROPERTY = new Map(
  [...AXIS_BY_JS_PROPERTY].map(([js, axis]) => [
    js.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
    axis,
  ]),
);

/**
 * The Tailwind utilities that set a property on either axis. `outline-[2px]`
 * is an outline width; `outline-[var(--x)]` and `outline-[red]` are not
 * lengths and never match.
 */
const AXIS_BY_TAILWIND_UTILITY = new Map([
  ...['min-h', 'min-w', 'h', 'w', 'size'].map((utility) => [utility, TARGET]),
  ...['outline', 'outline-offset'].map((utility) => [utility, FOCUS_RING]),
]);

const MESSAGES = {
  target:
    'Hardcoded touch target "{{value}}" in `{{property}}`. Use var(--target) (or var(--target-min) / var(--target-lg) for the dense and thumb-zone tiers). Run `pnpm ds tokens target`.',
  focusRing:
    'Hardcoded focus ring "{{value}}" in `{{property}}`. Use the focus ring tokens: var(--focus-ring-width) and var(--focus-ring-offset); an inset ring is calc(var(--focus-ring-width) * -1). Run `pnpm ds tokens focus-ring`.',
};

/** Is this object literal the value of a JSX `style` attribute? */
function isJsxStyleObject(object) {
  const container = object?.parent;
  const attribute = container?.parent;
  return (
    container?.type === 'JSXExpressionContainer' &&
    attribute?.type === 'JSXAttribute' &&
    jsxAttributeName(attribute) === 'style'
  );
}

/** A bare number, negated or not: `44`, `-2`. */
function numberLiteral(node) {
  if (node.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (
    node.type === 'UnaryExpression' &&
    node.operator === '-' &&
    node.argument.type === 'Literal' &&
    typeof node.argument.value === 'number'
  ) {
    return -node.argument.value;
  }
  return null;
}

/**
 * The values a style-object property can be read as. React renders a bare
 * number on a length property as pixels, so `style={{ minHeight: 44 }}` is
 * `44px`. Only inside a JSX `style` attribute, though: elsewhere a number is
 * as likely a DOMRect in a test or a canvas size as it is a style.
 *
 * @param {object} property
 * @returns {string[]}
 */
function styleValues(property) {
  const number = numberLiteral(property.value);
  if (number !== null) return isJsxStyleObject(property.parent) ? [`${number}px`] : [];
  return staticStrings(property.value);
}

export const jsRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow a raw 44px touch target or 2px focus ring in a style object or a Tailwind arbitrary value; reference --target and the --focus-ring-* tokens instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          classNameFunctions: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: MESSAGES,
  },

  create(context) {
    const options = context.options[0] ?? {};

    /** Every arbitrary value on either axis in one className string. */
    function checkClassName(node, className) {
      for (const { utility, value } of arbitraryValues(className)) {
        // `-outline-offset-[2px]` is Tailwind's negative: the value, negated.
        const negative = utility.startsWith('-');
        const axis = AXIS_BY_TAILWIND_UTILITY.get(negative ? utility.slice(1) : utility);
        const signed = negative ? `-${value}` : value;
        if (axis?.matches(signed)) {
          context.report({
            node,
            messageId: axis.messageId,
            data: { property: `${utility}-[${value.replaceAll(' ', '_')}]`, value },
          });
        }
      }
    }

    return {
      ...classNameVisitors(
        options.classNameFunctions ?? DEFAULT_CLASS_NAME_FUNCTIONS,
        checkClassName,
      ),

      // Every object property, not only JSX `style` ones: a style object
      // defined above the component ships the same literal.
      Property(node) {
        const name = propertyName(node);
        const axis = name ? AXIS_BY_JS_PROPERTY.get(name) : null;
        if (!axis) return;

        for (const value of styleValues(node)) {
          if (axis.matches(value)) {
            context.report({
              node: node.value,
              messageId: axis.messageId,
              data: { property: name, value },
            });
          }
        }
      },
    };
  },
};

export const cssRule = createCssRule(
  {
    description:
      'Disallow a raw 44px touch target or 2px focus ring in CSS; reference --target and the --focus-ring-* tokens instead.',
    messages: MESSAGES,
  },
  (property) => AXIS_BY_CSS_PROPERTY.get(property) ?? null,
);
