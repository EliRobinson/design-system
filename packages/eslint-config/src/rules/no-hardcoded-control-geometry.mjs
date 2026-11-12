// The two values #330 replaced with tokens in the component CSS: a 44px touch
// target (`--target`) and a 2px focus ring (`--focus-ring-width`,
// `--focus-ring-offset`). Spelled out, they stop following the tokens — the
// mobile floor, a palette that thickens its ring — and they come back easily,
// because 44 and 2 are the numbers everyone remembers.
//
// This is the style-object half; the stylesheet half is cssGeometryRule in
// ./no-hardcoded-css-values.mjs. Both read the axes from ./value-patterns.mjs.
//
// It is its own rule rather than two more axes of no-hardcoded-design-values
// only so it can ship as a warning: every app that predates the tokens has a
// `min-height: 44px` somewhere, and a rule that red-builds a consumer on
// upgrade gets deleted rather than worked through.
//
// Tailwind utilities (`min-h-11`, `outline-2`) are not read. They are spacing
// and width scales, not literals, and telling them apart from layout would
// need the utility as well as the value.

import { propertyName, staticStrings } from './ast-strings.mjs';
import { CONTROL_GEOMETRY_MESSAGES, axisForJsProperty, reportsLiteral } from './value-patterns.mjs';

/** Is this object literal the value of a JSX `style` attribute? */
function isJsxStyleObject(object) {
  const container = object?.parent;
  const attribute = container?.parent;
  return (
    container?.type === 'JSXExpressionContainer' &&
    attribute?.type === 'JSXAttribute' &&
    attribute.name.type === 'JSXIdentifier' &&
    attribute.name.name === 'style'
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

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow a raw 44px touch target or 2px focus ring in a style object; reference --target and the --focus-ring-* tokens instead.',
    },
    schema: [],
    messages: CONTROL_GEOMETRY_MESSAGES,
  },

  create(context) {
    return {
      // Every object property, not only JSX `style` ones: a style object
      // defined above the component ships the same literal.
      Property(node) {
        const name = propertyName(node);
        const axis = name ? axisForJsProperty(name) : null;
        if (axis?.rule !== 'geometry') return;

        for (const value of styleValues(node)) {
          if (reportsLiteral(axis, 'geometry', value)) {
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
