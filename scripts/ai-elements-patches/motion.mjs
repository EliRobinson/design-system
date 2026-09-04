/**
 * The reduced-motion half of the AI Elements transform layer.
 *
 * This is a separate module from `a11y.mjs`, and deliberately so. Every entry
 * in that file is a control's geometry, measured in a browser against the
 * shipped tokens, and classified against one of the two published
 * touch-target floors — `primary` (var(--target), 44x44) or `dense`
 * (var(--target-min), 24x24). `packages/ai-patterns/src/contracts.json`
 * publishes exactly those two verdicts under `vendoredElementTargets`, and
 * `elements-classification-parity.test.mjs` pins the two files to agree: every
 * id in `a11y.mjs`'s `PATCHES` must have a matching entry there, whose first
 * word is one of `primary` or `dense` and nothing else — the test's own words
 * are "invents a third tier".
 *
 * What lives here is neither. It is not a touch target at all — `Conversation`
 * scrolling its own `role="log"` is motion, not geometry — so it has no floor
 * to be measured against and no honest verdict to publish alongside
 * `button-floor` or `message-action-dense`. Filing it in `a11y.mjs` under a
 * verdict of `primary` would publish "Measured animated smooth scroll" inside
 * a section whose own `policy` string describes every entry as a control
 * measured against a touch-target floor — a claim that isn't true of this
 * finding. Widening the enum to accommodate a third tier would change a
 * contract that consumers read through `ds contracts` and the MCP server, for
 * every touch-target entry that already exists, to make room for one that
 * isn't a touch-target finding.
 *
 * So motion gets its own module and its own patch list, applied by its own
 * transform rule (`reduced-motion` in `ai-elements-transforms.mjs`), and is
 * simply absent from `vendoredElementTargets` — see the "What is deliberately
 * NOT here" note in `a11y.mjs`, which now names this alongside colour.
 *
 * The mechanism is otherwise identical to `a11y.mjs`, on purpose: the
 * transform layer runs on upstream bytes, so a patch here is a find/replace on
 * upstream source, and that is brittle by construction for the same reason
 * it is there — `assertPatch` below throws when an anchor does not appear
 * exactly the expected number of times, so the day upstream rewrites one of
 * these attributes, `pnpm sync:elements` fails loudly and names the control,
 * rather than dropping the fix and reporting a clean bump. An anchor miss here
 * is exactly as fatal as an anchor miss in `a11y.mjs`, and for the same
 * reason: silently not applying is the failure mode neither file tolerates.
 */

/**
 * Every motion patch. `behaviour` is what upstream does today, unpatched, and
 * `why` is the reason the vendored copy does not do that.
 *
 * `count` defaults to 1 and is the number of times `find` must occur in that
 * file. Stating it is what turns "upstream moved this" into a loud failure
 * instead of a partial application.
 */
export const PATCHES = [
  /* Motion inside a live region. `Conversation` is a `role="log"`, and it
     scrolls itself smoothly on every new turn and every resize. Nothing in
     the vendored tree reads prefers-reduced-motion, so that animation is
     unconditional for every reader.

     Our own ChatThread — which C1 retires in favour of this component — used
     a plain `scrollTop` assignment for exactly this reason, recorded in its
     source: an instant jump has no motion to reduce, so it sidesteps the care
     an animation in a live region would otherwise need. That property is the
     one thing theirs lacked, and it is two words.

     `{...props}` is spread last upstream, so a consumer who wants the
     animation back writes `<Conversation initial="smooth">`. This changes the
     default, not the API. `initial` and `resize` both type as `Animation =
     ScrollBehavior | SpringAnimation`, and "instant" is a ScrollBehavior. */
  {
    id: 'conversation-initial-instant',
    upstreamPath: 'packages/elements/src/conversation.tsx',
    control: 'conversation.tsx — Conversation, first paint',
    behaviour: 'animated smooth scroll on mount inside role="log"',
    why:
      'A live region that animates itself has no reduced-motion guard anywhere in ' +
      'the vendored tree. An instant jump has no motion to reduce, which is why our ' +
      'own retired ChatThread assigned scrollTop directly.',
    find: 'initial="smooth"',
    replace: 'initial="instant"',
  },
  {
    id: 'conversation-resize-instant',
    upstreamPath: 'packages/elements/src/conversation.tsx',
    control: 'conversation.tsx — Conversation, on resize',
    behaviour: 'animated smooth scroll on every content resize inside role="log"',
    why:
      'Same region, same reason, and this is the one that fires on every streamed ' +
      'token rather than once on mount.',
    find: 'resize="smooth"',
    replace: 'resize="instant"',
  },
];

function assertPatch(patch, source) {
  const count = patch.count ?? 1;
  const parts = source.split(patch.find).length - 1;

  if (parts !== count) {
    throw new Error(
      `ai-elements motion patch "${patch.id}" expected its anchor ${count} time(s) in ` +
        `${patch.upstreamPath} and found ${parts}.\n\n` +
        `  control:   ${patch.control}\n` +
        `  behaviour: ${patch.behaviour}\n` +
        `  anchor:    ${JSON.stringify(patch.find.slice(0, 120))}\n\n` +
        'Upstream has moved this control. Re-run the audit, re-measure the control, ' +
        'and update the anchor — do not delete the patch to make the bump pass, and ' +
        'do not edit the vendored file directly.',
    );
  }
}

/**
 * Apply every patch that belongs to one upstream file.
 *
 * @param {string} source upstream bytes, after the earlier transform rules
 * @param {string} upstreamPath
 * @returns {{ source: string, fired: boolean }}
 */
export function applyMotionPatches(source, upstreamPath) {
  const patches = PATCHES.filter((patch) => patch.upstreamPath === upstreamPath);
  if (patches.length === 0) return { source, fired: false };

  let current = source;
  for (const patch of patches) {
    assertPatch(patch, current);
    current = current.split(patch.find).join(patch.replace);
  }

  return { source: current, fired: true };
}

/** Every file this rule touches, for the sync check's reporting. */
export const patchedPaths = [...new Set(PATCHES.map((patch) => patch.upstreamPath))];
