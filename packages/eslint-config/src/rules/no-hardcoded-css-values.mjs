// The CSS half of no-hardcoded-design-values, for @eslint/css.
//
// It works on the declaration's source text rather than on css-tree's value
// AST: the checks are the same string-level checks the JS rule runs, and
// keeping one set of definitions is worth more than a tidier traversal.
//
// Custom-property *definitions* (--x: #fff) are the one place a literal
// belongs — that is what a token is — so they are left alone. Everything that
// consumes a value has to name a token.

const HEX_COLOR = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i;
const COLOR_FUNCTIONS = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lch|lab)\s*\(/i;
const MAGIC_LENGTH = /(?:^|[\s(,])\d*\.?\d+(?:px|rem|em)\b/;
const MAGIC_DURATION = /(?:^|[\s(,])\d*\.?\d+m?s\b/;

const COLOR_PROPERTIES =
  /^(?:color|background(?:-color)?|border(?:-[a-z]+)?-color|outline-color|text-decoration-color|caret-color|accent-color|fill|stroke|box-shadow|text-shadow)$/;
const RADIUS_PROPERTIES = /^border(?:-[a-z]+)*-radius$/;
const SHADOW_PROPERTIES = /^(?:box-shadow|text-shadow)$/;
const MOTION_PROPERTIES =
  /^(?:transition|transition-duration|transition-timing-function|animation|animation-duration|animation-timing-function)$/;

function isExempt(value) {
  return (
    value.includes('var(--') ||
    /^(?:0|none|inherit|initial|unset|revert|currentcolor|transparent)$/i.test(value.trim())
  );
}

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
