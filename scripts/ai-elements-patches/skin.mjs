/**
 * `token-skin` — the one transform rule that changes what a vendored component
 * looks like rather than where it imports from.
 *
 * Everything else about the skin needs no rule at all. Elements is Tailwind
 * utility markup, `@elirobinson/tokens/tailwind.css` maps Tailwind's colour,
 * radius, shadow and font namespaces onto the tokens, and every alias there is
 * `@theme inline` — so `bg-background`, `text-muted-foreground`, `border-border`
 * and `rounded-md` compile to `var(--token)` and answer to all three dials at
 * runtime. The overwhelming majority of the vendored tree is already on-brand
 * because of that, untouched.
 *
 * This rule exists for the residue the bridge cannot reach, which is exactly
 * two things:
 *
 *   1. Literal colours. `text-zinc-500`, `bg-red-100 dark:bg-red-900/30`,
 *      `text-white`, `bg-black/50`. These are Tailwind's own palette, not a
 *      design-system alias, so nothing re-points them: they stay that hex under
 *      `[data-theme="dark"]`, under `[data-palette="slate"]`, and across a
 *      tokens bump. Each one is rewritten to the token utility that carries the
 *      same meaning, and the pairing chosen is always one the token layer has
 *      measured — `bg-*-tint` with `text-*-ink` (6.2:1 or better in both
 *      themes), `bg-destructive` with `text-destructive-foreground` (5.06:1 or
 *      better in all four theme/palette cells).
 *
 *   2. shadcn's `--accent`. The shadcn/ui variable contract overlaps ours with
 *      a different meaning: shadcn's accent is a subtle hover tint, ours is
 *      Miltinson Amber, a brand signal. `hover:bg-accent` on a ghost button is
 *      correct upstream and renders as a brand-amber wash here. It becomes
 *      `bg-surface-2` — the first substitute `tailwind.css` names in note 1,
 *      and the one whose foreground is plain `--fg` in both themes.
 *
 * Both are strictly local rewrites of class tokens inside string literals. No
 * geometry is touched: not a width, height, padding, gap, min-size or hit area.
 *
 * Anything upstream adds later that is NOT in the tables below survives into
 * `src/` unchanged and is caught by `@elirobinson/no-hardcoded-design-values`,
 * which the repo's root `eslint.config.mjs` points at the vendored tree — the
 * one rule that runs there, and it has no fixer. That pairing is deliberate and
 * is the safety property of this file: it is better for a new literal to fail CI
 * loudly than for a broad regex to guess a token for it. Never widen an entry
 * into a pattern.
 */

/**
 * A class token, wherever it appears inside a string literal.
 *
 * Boundaries rather than whitespace, so a variant chain (`hover:`, `dark:`,
 * `data-[state=open]:`, `[&_svg]:`) and an HTML attribute (`class="…">`) both
 * fall outside the match and survive untouched. `/` is not a word character, so
 * `bg-accent` does not match inside `bg-accent-tint` but does match the
 * `bg-accent` in `bg-accent/50`, leaving the opacity modifier in place.
 */
const token = (literal) =>
  new RegExp(String.raw`(?<![\w-])${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\w-])`, 'g');

/**
 * Only the inside of a quoted, single-line string is rewritten.
 *
 * A class list is always one; a stray identifier in code never is.
 *
 * The two quote styles are alternatives rather than a backreference, so a span
 * may contain the other quote character. That is not tidiness — shadcn's own
 * class lists are full of `[&_svg:not([class*='text-'])]`, and a rule that
 * stopped at the first inner `'` would skip every dropdown, select and command
 * item in the tree, which is most of the `--accent` problem. It also makes the
 * one nested case come out right: the highlighter's
 * `'<span class="text-blue-600 dark:text-blue-400">{$1}</span>'` in
 * `schema-display.tsx` is read as the outer single-quoted span, and the pair
 * collapse below sees both halves inside it.
 */
const STRING_LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g;

/**
 * Light/dark pairs that collapse to a single token utility.
 *
 * Upstream writes a literal twice — once for the page and once behind `dark:` —
 * because a literal cannot follow a theme. A token already does, so the pair
 * becomes one utility and the `dark:` half goes away. Collapsing is what makes
 * this worth doing rather than rewriting each half in place: the second
 * declaration is not merely redundant after the rewrite, it is a second place
 * for the two to drift apart on the next bump.
 *
 * A `dark:` half with no light counterpart in the same string is NOT deleted —
 * it falls through to the table below and is rewritten in place. Losing a
 * declaration is a silent change; keeping a redundant one is not.
 */
const PAIRS = [
  ['bg-red-50', 'bg-red-900/20'],
  ['bg-red-100', 'bg-red-900/30'],
  ['bg-green-100', 'bg-green-900/30'],
  ['bg-yellow-100', 'bg-yellow-900/30'],
  ['bg-blue-100', 'bg-blue-900/30'],
  ['bg-orange-100', 'bg-orange-900/30'],
  ['bg-gray-100', 'bg-gray-900/30'],
  ['text-red-600', 'text-red-400'],
  ['text-red-700', 'text-red-400'],
  ['text-green-600', 'text-green-400'],
  ['text-green-700', 'text-green-400'],
  ['text-yellow-600', 'text-yellow-400'],
  ['text-yellow-700', 'text-yellow-400'],
  ['text-blue-600', 'text-blue-400'],
  ['text-blue-700', 'text-blue-400'],
  ['text-orange-600', 'text-orange-400'],
  ['text-orange-700', 'text-orange-400'],
  ['text-gray-700', 'text-gray-400'],
];

/**
 * literal class token -> token-backed class token.
 *
 * Read the hue column as a semantic, not as a colour: green is `success`, red
 * `destructive`, yellow `warning`, blue `info`. Orange is the one that is not a
 * status — upstream uses it as a fifth category beside yellow (an HTTP `PUT`
 * beside a `PATCH`, a denied tool call beside an errored one), and collapsing
 * it onto `warning` would make those two pairs identical. It maps to the brand
 * accent instead, which stays distinct from warning under both palettes.
 *
 * The terminal is the other judgement call. Upstream paints it zinc-950 on
 * zinc-100 — a dark chrome regardless of the page. This system has no token for
 * "always dark": `--bg-inverse` is the mirror of the page, so it would turn the
 * terminal WHITE under `[data-theme="dark"]`. `--bg-muted` is the token whose
 * documented job is "code blocks, inset wells", so the terminal follows the
 * theme instead of fighting it.
 */
const LITERALS = {
  // Status fills. `bg-*` is never text here — these are a progress bar's two
  // segments and a recording button's ring.
  'bg-green-500': 'bg-success',
  'bg-red-500': 'bg-destructive',
  'border-red-400/30': 'border-destructive/30',

  // Quiet panels and badges: the tint, with the ink measured against it.
  'bg-red-50': 'bg-destructive-tint',
  'bg-red-100': 'bg-destructive-tint',
  'bg-red-900/20': 'bg-destructive-tint',
  'bg-red-900/30': 'bg-destructive-tint',
  'bg-green-100': 'bg-success-tint',
  'bg-green-900/30': 'bg-success-tint',
  'bg-yellow-100': 'bg-warning-tint',
  'bg-yellow-900/30': 'bg-warning-tint',
  'bg-blue-100': 'bg-info-tint',
  'bg-blue-900/30': 'bg-info-tint',
  'bg-orange-100': 'bg-accent-tint',
  'bg-orange-900/30': 'bg-accent-tint',
  'bg-gray-100': 'bg-muted',
  'bg-gray-900/30': 'bg-muted',

  // Status-coloured text on the page. The fills cannot do this —
  // `--status-warning` is 1.87:1 — so `-ink` is the token that can.
  'text-red-400': 'text-destructive-ink',
  'text-red-600': 'text-destructive-ink',
  'text-red-700': 'text-destructive-ink',
  'text-green-400': 'text-success-ink',
  'text-green-600': 'text-success-ink',
  'text-green-700': 'text-success-ink',
  'text-yellow-400': 'text-warning-ink',
  'text-yellow-600': 'text-warning-ink',
  'text-yellow-700': 'text-warning-ink',
  'text-blue-400': 'text-info-ink',
  'text-blue-500': 'text-info-ink',
  'text-blue-600': 'text-info-ink',
  'text-blue-700': 'text-info-ink',
  'text-orange-400': 'text-accent-ink',
  'text-orange-600': 'text-accent-ink',
  'text-orange-700': 'text-accent-ink',
  // Secondary text, not tertiary. `--fg-3` (`text-muted-foreground`) is tuned
  // against `--bg` and `--surface`; on `--bg-muted`, which is where both of
  // these land, it measures 4.34:1 and misses SC 1.4.3. `--fg-2` is 7.57:1
  // there and 13.27:1 in dark, and is the closer read of upstream's intent
  // anyway — gray-700 and zinc-400 are its secondary text, not its quietest.
  'text-gray-400': 'text-foreground-2',
  'text-gray-700': 'text-foreground-2',

  // The terminal.
  'bg-zinc-950': 'bg-background-muted',
  'bg-zinc-800': 'bg-surface-3',
  'bg-zinc-100': 'bg-foreground',
  'text-zinc-100': 'text-foreground',
  'text-zinc-400': 'text-foreground-2',
  'border-zinc-800': 'border-border',

  // The modal scrim. `--scrim` carries its own alpha — heavier on a dark page,
  // because a wash that themed with the page would push the backdrop forward
  // instead of back — so the `/50` goes with the literal.
  'bg-black/50': 'bg-scrim',

  // shadcn's accent-as-hover-tint. See the header.
  'bg-accent': 'bg-surface-2',
  'text-accent-foreground': 'text-foreground',

  // The tooltip arrow's rounding, and the one non-colour entry here. It is a
  // literal on an axis the system owns, `--radius-xs` is 2px exactly, so this
  // is the same pixels today and follows `[data-platform="mobile"]` tomorrow.
  // Nothing else in the tree needs this treatment; a geometry literal with no
  // exact token behind it is left alone rather than guessed at.
  'rounded-[2px]': 'rounded-xs',
};

/**
 * Rewrites that are only correct in the company of another class.
 *
 * `text-white` is upstream's foreground for the destructive fill, and at this
 * release every one of its four occurrences sits on `bg-destructive` — where
 * the right answer is `--status-danger-on`, measured against that exact fill at
 * 5.41:1 light and 5.06:1 dark. It is emphatically NOT the right answer for a
 * white-on-anything-else, so the rewrite is conditional on the fill being in
 * the same class list. An unguarded `text-white` from a future bump is left
 * alone and fails the lint gate, which is the outcome we want.
 */
const GUARDED = [
  { from: 'text-white', to: 'text-destructive-foreground', within: 'bg-destructive' },
];

const PAIR_PATTERNS = PAIRS.map(([light, dark]) => ({
  light,
  // Bounded to the span already, so `[^\n]` is enough; non-greedy so the first
  // `dark:` half wins rather than the last.
  pattern: new RegExp(
    String.raw`(?<![\w-])(${light})(?![\w-])([^\n]*?)\s+dark:${dark}(?![\w-])`,
    'g',
  ),
}));

const LITERAL_PATTERNS = Object.entries(LITERALS).map(([from, to]) => ({
  to,
  pattern: token(from),
}));

const GUARD_PATTERNS = GUARDED.map(({ from, to, within }) => ({
  to,
  within: token(within),
  pattern: token(from),
}));

function rewriteClassList(span) {
  let out = span;

  for (const { pattern } of PAIR_PATTERNS) {
    out = out.replace(pattern, (_match, light, between) => `${light}${between}`);
  }

  for (const { pattern, to } of LITERAL_PATTERNS) {
    out = out.replace(pattern, to);
  }

  for (const { pattern, to, within } of GUARD_PATTERNS) {
    within.lastIndex = 0;
    if (within.test(out)) {
      out = out.replace(pattern, to);
    }
  }

  return out;
}

export const id = 'token-skin';

export const describe =
  'rewrote literal colours and radii, and shadcn’s accent-as-hover-tint, to design system tokens';

/**
 * @param {string} source
 * @returns {{ source: string, fired: boolean }}
 */
export function apply(source) {
  let fired = false;

  const out = source.replace(STRING_LITERAL, (match) => {
    const quote = match[0];
    const body = match.slice(1, -1);
    const rewritten = rewriteClassList(body);
    if (rewritten === body) {
      return match;
    }

    fired = true;
    return `${quote}${rewritten}${quote}`;
  });

  return { source: out, fired };
}
