// The CSS half of no-hardcoded-design-values, for @eslint/css.
//
// It works on the declaration's source text rather than on css-tree's value
// AST, so that the value it judges is the same kind of string the JS rule
// judges: both rules import what counts as a literal from ./value-patterns.mjs,
// and a value that is exempt in a style object is exempt in a stylesheet. Which
// property belongs to which axis comes from there too, keyed by the kebab-case
// spelling. What stays here is the declaration traversal, which
// no-hardcoded-control-geometry's CSS half shares through createCssRule.
//
// Custom-property *definitions* (--x: #fff) are the one place a literal
// belongs — that is what a token is — so they are left alone. Everything that
// consumes a value has to name a token.

import { axisForCssProperty } from './value-patterns.mjs';

/**
 * A CSS rule that judges each declaration's value. Custom-property definitions
 * are skipped; `axisFor` names the axis a property sits on for this rule, or
 * null if the rule ignores it.
 *
 * @param {object} meta  the rule's `docs.description` and `messages`
 * @param {(property: string) => { exempt: (v: string) => boolean, matches: (v: string) => boolean, messageId: string } | null} axisFor
 */
export function createCssRule({ description, messages }, axisFor) {
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
          const axis = axisFor(property);
          if (axis && !axis.exempt(value) && axis.matches(value)) {
            context.report({ node, messageId: axis.messageId, data: { property, value } });
          }
        },
      };
    },
  };
}

export const cssRule = createCssRule(
  {
    description:
      'Disallow hardcoded colour, radius, shadow and motion values in CSS; reference @elirobinson/tokens instead.',
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
  axisForCssProperty,
);

export default cssRule;
