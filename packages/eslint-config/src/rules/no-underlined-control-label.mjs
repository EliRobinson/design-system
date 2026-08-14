// A control does not dress up as a link.
//
// The reported pattern (#62) is a filled button — orange background, black
// label — with a black underline drawn under the label. The colours were fine;
// the underline was not. An underline is the one visual signal a hyperlink
// owns, and a control that draws one under its own label stops telling a reader
// whether the thing navigates or acts. It is also the reason "is this a link or
// a button?" is answerable at a glance in the first place.
//
// @elirobinson/react cannot produce this: `.ds-button` sets
// `text-decoration: none`, tokens.css repeats it for `a.ds-button` and friends,
// and two tests in @elirobinson/react pin both the declaration and the cascade
// that makes it win. A consumer's own stylesheet is the surface those cannot
// reach, and per the repo's own rule a constraint that reaches a consumer as
// prose is not shipped at all. So it ships as this.
//
// Scope, and why it is drawn where it is:
//
//   * The block has to paint its own fill. A `.btn--link` that underlines on a
//     plain background is a deliberate, common, and legible pattern; a link
//     that happens to sit on a highlight is a link. Neither is this bug. The
//     defect is specifically an underline *inside a filled control*.
//   * The selector has to read as a control. A consumer's class names are
//     unknowable, so this matches on whole words — `btn`, `button`, `cta`,
//     `chip`, `badge`, `pill`, `tab`, `pagination`, `segmented`, `action` — plus
//     the `button` element and the type/role attributes. Whole words, not
//     substrings, so `.data-table` and `.subtle-badge-free` do not match on
//     `tab` and `badge` by accident.
//   * It is one block at a time. A consumer who puts the underline on `.btn`
//     and the fill on `.btn--accent` escapes this, because deciding that
//     statically needs a cascade resolver. That case is covered inside this
//     repo by control-affordance.test.mjs, which resolves the real cascade;
//     here, a rule that guesses across blocks would fire on things it cannot
//     see and get switched off. A rule that fires on everything is a rule
//     nobody keeps.

/** Whole words in a class or id that mean "this is a control". */
const CONTROL_WORDS = new Set([
  'btn',
  'btns',
  'button',
  'buttons',
  'cta',
  'ctas',
  'chip',
  'chips',
  'badge',
  'badges',
  'pill',
  'pills',
  'tab',
  'tabs',
  'pagination',
  'segmented',
  'action',
  'actions',
]);

/** `.foo-bar`, `#fooBar` → the words a human reads in it. */
function words(name) {
  return name
    .slice(1)
    .split(/[-_]|(?=[A-Z])/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/**
 * Does this selector name a control?
 *
 * @param {string} selector
 * @returns {boolean}
 */
export function readsAsControl(selector) {
  if (/(?:^|[\s>+~,(])button\b/i.test(selector)) return true;
  if (/\[\s*type\s*[~|^$*]?=\s*["']?(?:button|submit|reset)\b/i.test(selector)) return true;
  if (/\[\s*role\s*[~|^$*]?=\s*["']?(?:button|tab|menuitem)\b/i.test(selector)) return true;
  return (selector.match(/[.#][A-Za-z_][\w-]*/g) ?? []).some((name) =>
    words(name).some((word) => CONTROL_WORDS.has(word)),
  );
}

/** Values of `background` / `background-color` that paint nothing. */
const NOT_A_FILL = /^(?:none|transparent|inherit|initial|unset|revert(?:-layer)?)$/i;

const isFill = (property, value) =>
  /^background(?:-color)?$/i.test(property) && !NOT_A_FILL.test(value.trim());

const isUnderline = (property, value) =>
  /^text-decoration(?:-line)?$/i.test(property) && /(?:^|\s)underline(?:\s|$)/i.test(value.trim());

export const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow underlining a control’s own label on a filled surface; an underline is a hyperlink’s signal, not a button’s.',
    },
    schema: [],
    messages: {
      underlinedControl:
        'Underlined label on a filled control ({{selector}}). `{{decoration}}` alongside `{{fill}}` reads as a hyperlink wearing a button, so a reader cannot tell whether it navigates or acts. Drop the underline and carry emphasis with the fill, the label weight, or a border.',
    },
  },

  create(context) {
    const { sourceCode } = context;

    return {
      Rule(node) {
        const selector = sourceCode.getText(node.prelude).trim().replace(/\s+/g, ' ');
        if (!readsAsControl(selector)) return;

        let fill = null;
        let decoration = null;

        for (const child of node.block?.children ?? []) {
          if (child.type !== 'Declaration') continue;
          const property = String(child.property ?? '');
          const text = sourceCode.getText(child);
          const value = text.slice(text.indexOf(':') + 1).trim();

          if (isFill(property, value)) fill = `${property}: ${value}`;
          else if (isUnderline(property, value)) decoration = `${property}: ${value}`;
        }

        if (fill && decoration) {
          context.report({
            node,
            messageId: 'underlinedControl',
            data: { selector, fill, decoration },
          });
        }
      },
    };
  },
};

export default rule;
