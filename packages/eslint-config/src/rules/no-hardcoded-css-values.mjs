// The CSS halves of no-hardcoded-design-values and
// no-hardcoded-control-geometry, for @eslint/css.
//
// It works on the declaration's source text rather than on css-tree's value
// AST, so that the value it judges is the same kind of string the JS rules
// judge: both languages import what counts as a literal from
// ./value-patterns.mjs, and a value that is exempt in a style object is exempt
// in a stylesheet. Which property belongs to which axis, and which rule owns
// that axis, comes from there too, keyed by the kebab-case spelling. What stays
// here is the declaration traversal.
//
// Custom-property *definitions* (--x: #fff) are the one place a literal
// belongs — that is what a token is — so they are left alone. Everything that
// consumes a value has to name a token.

import {
  CONTROL_GEOMETRY_MESSAGES,
  axisForCssProperty,
  reportsLiteral,
} from './value-patterns.mjs';

/**
 * @param {import('./value-patterns.mjs').AxisRule} axisRule
 * @param {string} description
 * @param {Record<string, string>} messages
 */
function createCssRule(axisRule, description, messages) {
  return {
    meta: { type: 'problem', docs: { description }, schema: [], messages },

    create(context) {
      const { sourceCode } = context;

      return {
        Declaration(node) {
          const property = String(node.property ?? '').toLowerCase();

          // Defining a token is the one place a literal belongs.
          if (property.startsWith('--')) return;

          const text = sourceCode.getText(node);
          const value = text.slice(text.indexOf(':') + 1).trim();
          if (!value) return;

          // One axis per property, so there is no branch order here to
          // disagree with the JS rule's — which is how `text-shadow: 0 0
          // rgb(...)` used to come out as a colour here and as a shadow there.
          const axis = axisForCssProperty(property);
          if (reportsLiteral(axis, axisRule, value)) {
            context.report({ node, messageId: axis.messageId, data: { property, value } });
          }
        },
      };
    },
  };
}

export const cssRule = createCssRule(
  'design',
  'Disallow hardcoded colour, radius, shadow and motion values in CSS; reference @elirobinson/tokens instead.',
  {
    color:
      'Hardcoded colour "{{value}}" in `{{property}}`. Reference a token: var(--fg), var(--accent), var(--border). Run `pnpm ds tokens color`.',
    radius:
      'Hardcoded radius "{{value}}" in `{{property}}`. Reference a token: var(--radius-md). Run `pnpm ds tokens radius`.',
    shadow:
      'Hardcoded shadow "{{value}}" in `{{property}}`. Reference a token: var(--shadow-md). Run `pnpm ds tokens shadow`.',
    duration:
      'Hardcoded motion value "{{value}}" in `{{property}}`. Reference a token: var(--dur-fast), var(--ease-out). Run `pnpm ds tokens dur`.',
  },
);

export const cssGeometryRule = createCssRule(
  'geometry',
  'Disallow a raw 44px touch target or 2px focus ring in CSS; reference --target and the --focus-ring-* tokens instead.',
  CONTROL_GEOMETRY_MESSAGES,
);

export default cssRule;
