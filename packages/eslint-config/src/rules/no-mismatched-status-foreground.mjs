// A status surface is a fill, the text drawn on it, and the line around it.
// Get any one of the three from the wrong token and the other two stop meaning
// anything.
//
// `--status-success` and `--status-warning` used to be brand aliases: they
// moved when the palette moved, so whatever the palette said was legible on
// them stayed legible on them. They now own palette-independent hues, which is
// the point — "danger" should not turn teal because someone picked a teal
// brand — but it is also what breaks the old habits. A hue that no longer
// follows the palette also no longer follows the theme, and the two tokens
// people reached for on a filled surface, `--fg-inverse` and `--fg-on-signal`,
// both do. So each status state now ships its own five members: `--status-X`
// (the fill, never text), `--status-X-on` (the text drawn ON that fill),
// `--status-X-fg` (status-coloured text on `--bg`/`--surface`),
// `--status-X-tint`, and `--status-X-tint-edge`.
//
// Inside this repo the pairing is settled by packages/tokens' contrast.test.mjs,
// which sweeps palette x theme and measures every `-on` against its own fill. A
// consumer's own stylesheet is the surface that sweep cannot reach, and per the
// repo's own rule a constraint that arrives as prose is not shipped at all. So
// it ships as this.
//
// Scope, and why it is drawn where it is:
//
//   * One rule, not three. The three defects look unrelated as strings and are
//     one property in practice: the foreground and the edge of a status
//     surface. They are found together, migrated together in one edit, and a
//     consumer who wants to think about this at all wants all three on. Three
//     rule ids would mean three entries to enable, three ways to be half
//     migrated, and — worse — three separate opportunities to switch one off
//     and believe the surface is still checked. What earns separate identities
//     is the messages, so there are three messageIds behind one id.
//   * One block at a time, and never across blocks. Defect 1 needs a fill and a
//     foreground together; deciding that a `color` in one rule lands on a
//     `background` from another needs a cascade resolver and a known DOM. A
//     rule that guesses fires on things it cannot see, and a rule that fires on
//     things it cannot see gets switched off. The cross-block case is covered
//     inside this repo by the stylesheet sweeps, which resolve the real
//     cascade.
//   * `--status-warning` as a `background` is correct and must stay silent.
//     The hue is 1.87:1 against `--bg` in light — a documented SC 1.4.11
//     exception, taken deliberately because a warning that reads as amber is
//     worth more than a warning that reads as brown. The exception holds only
//     while the hue is a *fill*, where the text on it carries the contrast.
//     The moment it is a line, nothing else carries anything and 1.87:1 is the
//     whole signal. That is why only the edge half is flagged, and why a bare
//     `background: var(--status-warning)` is left alone.
//   * The bare-token match must not swallow the family. `--status-warning-border`
//     (3.76:1 light, 11.22:1 dark), `--status-warning-on`, `--status-warning-fg`
//     and `--status-warning-tint-edge` are the *fixes*; a substring match on
//     `--status-warning` would flag every one of them and tell a consumer who
//     already migrated to migrate again. So every token here is matched as a
//     whole `var()` reference with a `[,)]` terminator, the same way
//     no-decorative-control-edge matches `--border` without catching
//     `--border-control`.
//   * No selector heuristic. Its two siblings have to guess whether a class
//     name means "control", because an underline or a hairline is only a defect
//     on certain things. This rule has no such problem: `--status-danger` on a
//     background *is* a status fill, whatever the block is called, and
//     `--fg-on-signal` is legacy wherever it appears. Inventing an element-name
//     word list here would only add false negatives on names we failed to
//     imagine.

/* `border`, `border-color`, `border-top`, `border-inline-start-color`, … —
   the spellings that can carry the line's colour. The geometry-only longhands
   are excluded by name rather than by guessing. */
const GEOMETRY_ONLY =
  /^border-(?:radius|width|style|spacing|collapse|image(?:-\w+)?|[a-z-]*-(?:radius|width|style))$/i;

/**
 * Does this property paint a line the user sees the colour of?
 *
 * Borders plus the two other rules a stylesheet can draw: `outline`, which is
 * how a focus ring and many error edges are painted, and `column-rule`, which
 * is a border in everything but name. `outline-width` and `outline-style`
 * carry no colour and are left out for the same reason `border-width` is.
 *
 * @param {string} property
 * @returns {boolean}
 */
export function paintsAnEdge(property) {
  if (/^(?:outline|outline-color|column-rule|column-rule-color)$/i.test(property)) return true;
  return /^border(?:-[a-z-]+)?$/i.test(property) && !GEOMETRY_ONLY.test(property);
}

/** The bare status fills, matched as whole `var()` references. */
const STATUS_FILL = /var\(\s*--status-(success|warning|danger|info)\s*[,)]/;

/**
 * Which status state does this value paint as a bare fill, if any?
 *
 * Returns null for every other member of the family — `-on`, `-fg`, `-tint`,
 * `-tint-edge`, `-border` — because those are what a migrated stylesheet uses.
 *
 * @param {string} value
 * @returns {string | null}
 */
export function statusFillState(value) {
  return value.match(STATUS_FILL)?.[1] ?? null;
}

/** The warning fill, specifically — the one hue that may never draw a line. */
const WARNING_FILL = /var\(\s*--status-warning\s*[,)]/;

/** The two foregrounds that flip with the theme while a status fill does not. */
const THEME_FLIPPING_FG = /var\(\s*(--fg-inverse|--fg-on-signal)\s*[,)]/;

/** The legacy alias, wherever it appears. */
const LEGACY_SIGNAL_FG = /var\(\s*--fg-on-signal\s*[,)]/;

const isFill = (property) => /^background(?:-color)?$/i.test(property);
const isForeground = (property) => /^color$/i.test(property);

export const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the foreground and edge mistakes a status surface invites: a theme-flipping --fg-inverse/--fg-on-signal on a status fill, --status-warning painting a line, and the legacy --fg-on-signal alias anywhere.',
    },
    schema: [],
    messages: {
      themeFlippingStatusForeground:
        'Theme-flipping text on a status fill ({{selector}}). `{{fill}}` paints --status-{{state}}, which owns its hue and does not move between light and dark, but `{{foreground}}` does — so whichever theme it was measured in, the other one lands under 4.5:1. Neither var(--fg-inverse) nor var(--fg-on-signal) can be right in both. Use var(--status-{{state}}-on), which is the text measured against that exact fill in every palette x theme combination.',
      warningEdge:
        'Unedged warning line (`{{declaration}}`). --status-warning is 1.87:1 against --bg in light — a documented SC 1.4.11 exception that holds only while the hue is a fill and the text on it carries the contrast. As a line it is the whole signal and 1.87:1 is not enough of one. Use var(--status-warning-border) (3.76:1 light, 11.22:1 dark).',
      legacySignalForeground:
        'Legacy token in `{{declaration}}`. --fg-on-signal survives only as an alias of --accent-fg and collapses to an unmeasured value under any non-default palette. Use var(--accent-fg) — or, if this text sits on a status fill, var(--status-<state>-on).',
    },
  },

  create(context) {
    const { sourceCode } = context;

    return {
      // Defect 1 is the only one that needs two declarations to agree, so it is
      // the only one that needs the block.
      Rule(node) {
        const selector = sourceCode.getText(node.prelude).trim().replace(/\s+/g, ' ');

        let fill = null;
        let state = null;
        let foreground = null;

        for (const child of node.block?.children ?? []) {
          if (child.type !== 'Declaration') continue;
          const property = String(child.property ?? '');
          const text = sourceCode.getText(child);
          const value = text.slice(text.indexOf(':') + 1).trim();

          if (isFill(property)) {
            const matched = statusFillState(value);
            if (matched) {
              fill = `${property}: ${value}`;
              state = matched;
            }
          } else if (isForeground(property) && THEME_FLIPPING_FG.test(value)) {
            foreground = `${property}: ${value}`;
          }
        }

        if (fill && foreground) {
          context.report({
            node,
            messageId: 'themeFlippingStatusForeground',
            data: { selector, fill, foreground, state },
          });
        }
      },

      // Defects 2 and 3 are properties of a single declaration, so they are
      // decided on one.
      Declaration(node) {
        const property = String(node.property ?? '');
        const text = sourceCode.getText(node);
        const value = text.slice(text.indexOf(':') + 1).trim();
        const declaration = `${property}: ${value}`;

        if (paintsAnEdge(property) && WARNING_FILL.test(value)) {
          context.report({ node, messageId: 'warningEdge', data: { declaration } });
        }

        // Note the missing `if (property.startsWith('--')) return` that
        // no-hardcoded-css-values opens with. That rule exempts custom-property
        // definitions because defining a literal is exactly what a token layer
        // is for. This one is the opposite case: a consumer writing
        // `--my-badge-fg: var(--fg-on-signal)` has not defined anything, they
        // have aliased a legacy token into a name of their own and buried the
        // problem one indirection deeper. That is squarely what this is for, so
        // `--*` definitions are checked like any other declaration.
        if (LEGACY_SIGNAL_FG.test(value)) {
          context.report({ node, messageId: 'legacySignalForeground', data: { declaration } });
        }
      },
    };
  },
};

export default rule;
