// The CSS half of no-hardcoded-design-values, for @eslint/css.
//
// It works on the declaration's source text rather than on css-tree's value
// AST, so that the value it judges is the same kind of string the JS rule
// judges: both rules import what counts as a literal from ./value-patterns.mjs,
// and a value that is exempt in a style object is exempt in a stylesheet. What
// stays here is CSS-specific — which property names belong to which axis, and
// the declaration traversal.
//
// Custom-property *definitions* (--x: #fff) are the one place a literal
// belongs — that is what a token is — so they are left alone. Everything that
// consumes a value has to name a token.

import {
  COLOR_FUNCTIONS,
  HEX_COLOR,
  MAGIC_DURATION,
  MAGIC_LENGTH,
  isExempt,
} from './value-patterns.mjs';

const COLOR_PROPERTIES =
  /^(?:color|background(?:-color)?|border(?:-[a-z]+)?-color|outline-color|text-decoration-color|caret-color|accent-color|fill|stroke|box-shadow|text-shadow)$/;
const RADIUS_PROPERTIES = /^border(?:-[a-z]+)*-radius$/;
const SHADOW_PROPERTIES = /^(?:box-shadow|text-shadow)$/;
const MOTION_PROPERTIES =
  /^(?:transition|transition-duration|transition-timing-function|animation|animation-duration|animation-timing-function)$/;

export const cssRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded colour, radius, shadow and motion values in CSS; reference @elirobinson/tokens instead.',
    },
    schema: [],
    messages: {
      color:
        'Hardcoded colour "{{value}}" in `{{property}}`. Reference a token: var(--fg), var(--accent), var(--border). Run `pnpm ds tokens color`.',
      radius:
        'Hardcoded radius "{{value}}" in `{{property}}`. Reference a token: var(--radius-md). Run `pnpm ds tokens radius`.',
      shadow:
        'Hardcoded shadow "{{value}}" in `{{property}}`. Reference a token: var(--shadow-md). Run `pnpm ds tokens shadow`.',
      duration:
        'Hardcoded motion value "{{value}}" in `{{property}}`. Reference a token: var(--dur-fast), var(--ease-out). Run `pnpm ds tokens dur`.',
    },
  },

  create(context) {
    const { sourceCode } = context;

    return {
      Declaration(node) {
        const property = String(node.property ?? '').toLowerCase();

        // Defining a token is the one place a literal belongs.
        if (property.startsWith('--')) return;

        const text = sourceCode.getText(node);
        const value = text.slice(text.indexOf(':') + 1).trim();
        if (!value || isExempt(value)) return;

        const data = { property, value };

        if (RADIUS_PROPERTIES.test(property) && MAGIC_LENGTH.test(value)) {
          context.report({ node, messageId: 'radius', data });
          return;
        }

        if (SHADOW_PROPERTIES.test(property) && MAGIC_LENGTH.test(value)) {
          context.report({ node, messageId: 'shadow', data });
          return;
        }

        if (
          MOTION_PROPERTIES.test(property) &&
          (MAGIC_DURATION.test(value) || value.includes('cubic-bezier'))
        ) {
          context.report({ node, messageId: 'duration', data });
          return;
        }

        if (
          COLOR_PROPERTIES.test(property) &&
          (HEX_COLOR.test(value) || COLOR_FUNCTIONS.test(value))
        ) {
          context.report({ node, messageId: 'color', data });
        }
      },
    };
  },
};

export default cssRule;
