// Functional UI copy is chrome. It states the fact, then the consequence, then
// the action, and stops. This rule catches the six ways it gets padded into
// marketing instead — see `pnpm ds patterns`, "UI Copy Is Chrome", for the rule
// this enforces a piece of.
//
// The scope is the whole design of it. A product's editorial voice — its
// marketing prose, its conversational surfaces, its written deliverables — is
// content, it is a deliberate design decision, and it is none of this rule's
// business. So the rule never reads arbitrary JSX text. It reads two things:
//
//   1. props that are chrome by name  — title, description, label, placeholder
//   2. the children of chrome components — Alert, Toast, Tooltip, EmptyState…
//
// A landing page's <p> is untouched by construction, not by a heuristic. The
// cost is that chrome living in an unrecognised component is missed; that is
// the right way round, because a rule that flagged a product's voice would be
// switched off within a day and catch nothing at all.

import { hasExclamation, paddingIn } from './copy-patterns.mjs';
import { jsxAttributeName, jsxElementName, staticStrings } from './ast-strings.mjs';

/** Props that are chrome wherever they appear, because the name says so. */
const DEFAULT_COPY_PROPS = [
  'title',
  'description',
  'label',
  'placeholder',
  'helperText',
  'helpText',
  'hint',
  'hintText',
  'error',
  'errorText',
  'errorMessage',
  'emptyMessage',
  'tooltip',
  'confirmLabel',
  'cancelLabel',
  'aria-label',
  'aria-description',
];

/**
 * Components whose children are chrome by definition. Names, not imports —
 * a consuming repo's Alert may be its own wrapper, and the wrapper is still
 * an alert.
 */
const DEFAULT_CHROME_COMPONENTS = [
  'Alert',
  'AlertTitle',
  'AlertDescription',
  'Toast',
  'ToastTitle',
  'ToastDescription',
  'Tooltip',
  'TooltipContent',
  'Callout',
  'Banner',
  'Notice',
  'EmptyState',
  'ErrorMessage',
  'ErrorState',
  'FormMessage',
  'FormDescription',
  'HelperText',
  'HintText',
  'InlineMessage',
  'StatusMessage',
  'DialogDescription',
  'AlertDialogDescription',
  'ValidationMessage',
];

const GUIDANCE =
  'Functional UI copy is chrome: state the fact, the consequence, and the action, then stop.';

/** Text of every JSXText descendant, in source order. */
function textOf(node, out = []) {
  for (const child of node.children ?? []) {
    if (child.type === 'JSXText') out.push(child.value);
    else if (child.type === 'JSXElement' || child.type === 'JSXFragment') textOf(child, out);
    else if (child.type === 'JSXExpressionContainer') {
      // `{' '}` and a conditional string are copy the same as bare text is.
      out.push(...staticStrings(child.expression));
    }
  }
  return out;
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow reassurance, blame, filler and enthusiasm padding in functional UI copy. Does not apply to editorial content.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          props: { type: 'array', items: { type: 'string' } },
          components: { type: 'array', items: { type: 'string' } },
          allow: { type: 'array', items: { type: 'string' } },
          exclamation: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      frequency: `Unverifiable frequency claim "{{phrase}}" — you do not have that data. ${GUIDANCE}`,
      blame: `Blame attribution "{{phrase}}" — say what is observable, not whose fault it might be. ${GUIDANCE}`,
      pacing: `Filler pacing "{{phrase}}" — say what happens, not how long it feels. ${GUIDANCE}`,
      reassurance: `Unprompted reassurance "{{phrase}}" — reassure only where the reader is asking, and as a fact ("You have not been charged"). ${GUIDANCE}`,
      escalation: `Unasked escalation path "{{phrase}}" — that belongs in a support surface, not in a control. ${GUIDANCE}`,
      enthusiasm: `Enthusiasm "{{phrase}}" — chrome does not celebrate. ${GUIDANCE}`,
      exclamation: `Exclamation mark in functional copy. ${GUIDANCE}`,
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const copyProps = new Set([...DEFAULT_COPY_PROPS, ...(options.props ?? [])]);
    const chrome = new Set([...DEFAULT_CHROME_COMPONENTS, ...(options.components ?? [])]);
    const allow = new Set((options.allow ?? []).map((phrase) => phrase.toLowerCase()));
    const flagExclamation = options.exclamation ?? true;

    /** Chrome nests — an Alert around an AlertDescription is one message. */
    let insideChrome = 0;

    // A namespaced element is chrome if any part of its name is. `Toast` and
    // `Toast.Description` and `ToastDescription` are three spellings of the
    // same component, and the compound spellings are already in the list.
    function isChrome(node) {
      const name = jsxElementName(node.openingElement?.name);
      if (!name) return false;
      if (chrome.has(name)) return true;

      const segments = name.split('.');
      return chrome.has(segments.join('')) || segments.some((segment) => chrome.has(segment));
    }

    // A conditional prop — title={ok ? 'Saved!' : 'Done!'} — reaches `check`
    // once per branch on the same node. One node, one message.
    const reported = new Set();

    function report(node, messageId, phrase) {
      const key = `${node.range?.[0]}:${node.range?.[1]}:${messageId}:${phrase ?? ''}`;
      if (reported.has(key)) return;
      reported.add(key);
      context.report({ node, messageId, data: { phrase } });
    }

    function check(node, text) {
      for (const { messageId, phrase } of paddingIn(text)) {
        if (allow.has(phrase)) continue;
        report(node, messageId, phrase);
      }

      if (flagExclamation && hasExclamation(text)) report(node, 'exclamation');
    }

    return {
      JSXAttribute(node) {
        const name = jsxAttributeName(node);
        if (!name || !copyProps.has(name)) return;

        for (const value of staticStrings(node.value)) check(node, value);
      },

      JSXElement(node) {
        if (!isChrome(node)) return;

        // Only the outermost chrome element reads the text, so a phrase inside
        // a nested one is not reported once per level.
        if (insideChrome === 0) check(node.openingElement, textOf(node).join(' '));
        insideChrome += 1;
      },

      'JSXElement:exit'(node) {
        if (isChrome(node)) insideChrome -= 1;
      },
    };
  },
};
