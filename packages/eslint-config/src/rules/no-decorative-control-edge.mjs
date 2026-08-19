// A control's edge is a graphic a user relies on; a decorative hairline is not.
//
// `--border` (1.24:1 against `--bg`) and `--border-strong` (1.53:1) are
// deliberately below the 3:1 SC 1.4.11 asks of a control boundary. They are for
// separating one surface from another — card seams, table rules, dividers, the
// edge of a floating panel — where nothing depends on seeing the line. The
// moment an edge is the only thing telling a user where an input, a toggle or a
// chip is, it is a control boundary and wants `--border-control` (3.64:1 light,
// 3.95:1 dark), which exists for exactly this.
//
// Both tokens measure correctly on their own, so a per-token contrast sweep
// cannot see the mistake: it is a component reaching for the wrong one. Inside
// this repo that is caught by component-css.test.mjs, which sweeps every
// shipped stylesheet. A consumer's own stylesheet is the surface that cannot
// reach, and per the repo's own rule a constraint that arrives as prose is not
// shipped at all. So it ships as this — the edge counterpart to
// no-underlined-control-label.
//
// Scope, and why it is drawn where it is:
//
//   * Only our own decorative tokens are flagged. `border: 1px solid #ddd` is
//     no-hardcoded-design-values' job, and a consumer's own `--border` that
//     happens to share the name is not something a static rule can tell apart —
//     but a project consuming these tokens is the one this rule is for.
//   * The vocabulary is this rule's own, deliberately narrower than
//     no-underlined-control-label's `readsAsControl`. The two questions want
//     different lists: a badge or a tab strip paints a fill, so an underline
//     inside it is a defect, but its border is trim — `.ds-badge--outline` and
//     the rule under `.ds-tabs__list` are decorative on purpose, and inheriting
//     the fill vocabulary flagged both. What belongs here is the narrower set
//     whose *edge* is the whole affordance: an input, a switch, a chip, a
//     stepper. A checkbox with an invisible border is an invisible checkbox; a
//     badge with one is still a badge.
//   * Container words are left out for the same reason. `combobox` and `picker`
//     name a whole widget — the input inside it and the panel it opens — and a
//     panel edge is a surface seam. The input half still matches on `input`,
//     and the ARIA roles still match exactly.
//   * Only colour-bearing border properties. `border-radius`, `border-width`
//     and friends never paint the line, and flagging them would fire on
//     geometry.
//   * One block at a time, for the same reason the underline rule is: deciding
//     across blocks needs a cascade resolver, and a rule that guesses fires on
//     things it cannot see and gets switched off.

/** Whole words in a class or id whose edge is what tells a user it is there. */
const EDGE_WORDS = new Set([
  'btn',
  'btns',
  'button',
  'buttons',
  'cta',
  'ctas',
  'chip',
  'chips',
  'action',
  'actions',
  'pagination',
  'segmented',
  'input',
  'inputs',
  'textbox',
  'textarea',
  'field',
  'fields',
  'fieldset',
  'select',
  'selects',
  'switch',
  'switches',
  'toggle',
  'toggles',
  'checkbox',
  'checkboxes',
  'radio',
  'radios',
  'slider',
  'sliders',
  'stepper',
  'steppers',
  'search',
  'searchbox',
  'searchfield',
  'kbd',
  'trigger',
  'triggers',
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
 * Does this selector name something whose edge a user relies on?
 *
 * @param {string} selector
 * @returns {boolean}
 */
export function readsAsControlEdge(selector) {
  if (/(?:^|[\s>+~,(])(?:button|input|select|textarea)\b/i.test(selector)) return true;
  if (
    /\[\s*type\s*[~|^$*]?=\s*["']?(?:button|submit|reset|text|search|email|url|tel|password|number|checkbox|radio)\b/i.test(
      selector,
    )
  ) {
    return true;
  }
  if (
    /\[\s*role\s*[~|^$*]?=\s*["']?(?:button|textbox|checkbox|radio|switch|slider|combobox|searchbox|spinbutton)\b/i.test(
      selector,
    )
  ) {
    return true;
  }
  return (selector.match(/[.#][A-Za-z_][\w-]*/g) ?? []).some((name) =>
    words(name).some((word) => EDGE_WORDS.has(word)),
  );
}

/* `border`, `border-color`, `border-top`, `border-inline-start-color`, … —
   the spellings that can carry the line's colour. The geometry-only longhands
   are excluded by name rather than by guessing. */
const GEOMETRY_ONLY =
  /^border-(?:radius|width|style|spacing|collapse|image(?:-\w+)?|[a-z-]*-(?:radius|width|style))$/i;

const isBorderPaint = (property) =>
  /^border(?:-[a-z-]+)?$/i.test(property) && !GEOMETRY_ONLY.test(property);

/** The decorative edge tokens, matched as whole `var()` references. */
const DECORATIVE = /var\(\s*(--border(?:-strong)?)\s*[,)]/;

export const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow painting a control’s edge with the decorative --border/--border-strong tokens; a control boundary needs --border-control to clear 3:1 under SC 1.4.11.',
    },
    schema: [],
    messages: {
      decorativeEdge:
        'Decorative edge on a control ({{selector}}). `{{declaration}}` uses var({{token}}), which is a surface seam at 1.24:1/1.53:1 against --bg — below the 3:1 SC 1.4.11 asks of the boundary that tells a user where a control is. Use var(--border-control).',
    },
  },

  create(context) {
    const { sourceCode } = context;

    return {
      Rule(node) {
        const selector = sourceCode.getText(node.prelude).trim().replace(/\s+/g, ' ');
        if (!readsAsControlEdge(selector)) return;

        for (const child of node.block?.children ?? []) {
          if (child.type !== 'Declaration') continue;
          const property = String(child.property ?? '');
          if (!isBorderPaint(property)) continue;

          const text = sourceCode.getText(child);
          const value = text.slice(text.indexOf(':') + 1).trim();
          const token = value.match(DECORATIVE)?.[1];
          if (!token) continue;

          context.report({
            node: child,
            messageId: 'decorativeEdge',
            data: { selector, declaration: `${property}: ${value}`, token },
          });
        }
      },
    };
  },
};

export default rule;
