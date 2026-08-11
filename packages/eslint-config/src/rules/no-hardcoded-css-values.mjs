// The CSS half of no-hardcoded-design-values, for @eslint/css.
//
// It works on the declaration's source text rather than on css-tree's value
// AST, so that the declaration it judges is the same kind of pair the JS rule
// judges: both rules hand a property and a value string to `hardcodedAxis` in
// ./value-patterns.mjs, which owns both which properties belong to which axis
// and what counts as a literal. What stays here is CSS-specific — the
// declaration traversal and the wording of the messages.
//
// Custom-property *definitions* (--x: #fff) are the one place a literal
// belongs — that is what a token is — so they are left alone. Everything that
// consumes a value has to name a token.

import { hardcodedAxis } from './value-patterns.mjs';

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
        if (!value) return;

        const messageId = hardcodedAxis(property, value);
        if (messageId) context.report({ node, messageId, data: { property, value } });
      },
    };
  },
};

export default cssRule;
