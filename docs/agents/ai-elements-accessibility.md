# AI Elements accessibility audit

What happened when the four browser-settled contracts in
`@elirobinson/ai-patterns/testing/playwright` were pointed at the vendored tree for the
first time, what was changed as a result, and what was deliberately left for somebody
else.

The classifications themselves are **not here**. They are in
`packages/ai-patterns/src/contracts.json` under `vendoredElementTargets`, because a
consumer has to be able to read them without reading this repo — `ds contracts` prints
them, and the MCP server serves them. A parity test
(`packages/ai-patterns/src/testing/elements-classification-parity.test.mjs`) fails if that
list and the transform layer ever disagree. This page is the method and the leftovers.

## How it was measured

`packages/ai-elements/a11y` is a Vite harness that mounts one vendored component per page
load and a Playwright spec that runs all four checks over it.

```bash
pnpm a11y:elements          # build the package, build the harness, run the sweep
```

576 assertions: **48 components** (the whole `components` tier of
`@elirobinson/ai-elements/manifest`) x **2 themes** x **3 palettes** x **2 platform
settings**, each running `checkTouchTargets`, `checkHitAreaOverlap`, `checkFocusVisible`
and `checkContrast`.

Four things about the harness are load-bearing:

- **The roster comes from the manifest, not from a list.** A component upstream adds shows
  up in the next sweep by itself, and shows up _failing_: the harness reports "no fixture
  named …" and the spec's first assertion is on that. Nobody has to remember.
- **A fixture that throws is a failure, not a pass.** Four checks over a component that
  never rendered report a clean sweep. The spec asserts `data-fixture-error` is unset
  before it asserts anything else — the same false-green this file's subject matter is
  full of.
- **Fixtures render the composition a consumer would write.** A `<Message>` with no
  `<MessageActions>` has no controls in it. Collapsibles, menus and dialogs are opened,
  because that is where their controls are.
- **The stylesheet is the one a consumer is told to write.** Three imports:
  `tailwindcss`, `@elirobinson/tokens/tokens.css`, `@elirobinson/tokens/tailwind.css`. No
  harness-only theme. That is what makes the contrast numbers below real, and it is why
  `data-palette` and `data-platform` in the matrix are dials rather than decoration.

Selectors are **unscoped**, unlike `tests/visual/contracts.ts`, which scopes to
`#storybook-root`. A Storybook page is mostly framework chrome and a docs page is mostly
prose; this harness renders one fixture and nothing else. Scoping would also have lost
coverage, because Radix portals a dropdown's items and a dialog's controls to
`document.body`.

## Results

Baseline, before any patch (distinct controls, deduplicated across the 12 dial
combinations):

| Check                 | Before                                           | After                              |
| --------------------- | ------------------------------------------------ | ---------------------------------- |
| `checkTouchTargets`   | 61 controls across 39 components                 | 0 (1 documented exception)         |
| `checkHitAreaOverlap` | 0                                                | 0                                  |
| `checkFocusVisible`   | 2                                                | 0                                  |
| `checkContrast`       | 24 findings across 4 components, dark theme only | unchanged — not this card's to fix |

Every verdict above is **MEASURED** except one, which is marked PREDICTED in
`contracts.json`: `ui/select.tsx`'s `SelectItem`. No fixture in the harness opens a
`<Select>` menu; it was patched because its markup is character-for-character the
`CommandItem` and `DropdownMenuItem` pattern that _was_ measured at 32px, and leaving one
menu row at a different height from the two beside it would read as a defect.

### Touch targets

The shape of the finding is uniform and unsurprising: shadcn/Radix draws controls at
32-40px, which clears WCAG 2.2 AA (SC 2.5.8, 24x24) comfortably and misses this system's
44x44 default, which is AAA (SC 2.5.5). The interesting part was never the number; it was
deciding, per control, whether 44 or 24 is the right floor — recorded in `contracts.json`
as 28 entries, 17 primary and 11 dense.

Two findings are worth pulling out of that list because they are not about density at all:

- **`ui/dialog.tsx`'s close button is 16x16.** It misses the dense floor as well, so
  "declare it dense" was never an available answer. Its hit area now grows to
  `var(--target)` around an unchanged 16px glyph.
- **`sources.tsx` renders 16px-tall rows.** Both the disclosure trigger and each citation
  `<a href>`. These are the "source markers" the card predicted, and they were the worst
  targets in the tree.

### The mobile dial reaches vendored markup — halfway

`tokens.css` floors `button`, `[role="button"]`, `a.ds-button`, `input` and `select` to
`min-height: var(--target)` under `[data-platform="mobile"]`, minus the dense exclusion
list. That rule was written for our own components, and it turns out to reach a vendored
`<button>` exactly as well — the baseline sweep showed 32px controls becoming 44px tall on
the mobile dial with no change from us.

It only reaches halfway, and both halves are worth knowing:

- It floors **height only**, so an icon-only button went to 32x44 and still failed.
- Its subject list is `button`-shaped, so it never reached cmdk's `div[role="option"]`
  menu rows, a dropdown's `a[role="menuitem"]`, or a citation `<a href>` — all of which
  are in `PRIMARY_CONTROL_SELECTOR` and all of which were failing.

`checkTouchTargets` applies 44x44 on every platform anyway, so the patches floor these
controls unconditionally rather than only on a phone. The mobile rule is not redundant —
it is what keeps a control the _consumer_ writes honest — but it was never going to be
this audit's fix.

### Focus-visible: the two findings were a bug in the check

Both hits were `ui/dialog.tsx`'s close button, in all 12 dial combinations, and the ring
was fine. Radix's Dialog moves focus to that button when it opens, so by the time
`checkFocusVisible` reached it the control **already had focus**: `before` was a snapshot
of the focused state, `.focus()` was a no-op, and the two matched.

That is the same failure family as #79 and #137 and the inert-modal case the function
already guarded — a probe that could not run reported as a result — pointing the other
way. `checkFocusVisible` now blurs a control that already holds focus before taking the
`before` snapshot, in both the programmatic and the keyboard branch, with two tests
pinning it. Every open dialog on any page was producing one of these, so the fix is not
specific to Elements.

## Handover: colour, and the Tailwind bridge

Nothing in this card changed a colour value. The sweep found two colour causes and handed
both to the token bridge. The first is now fixed; the second is still open.

**1. Tailwind's `dark` variant never fired (89 utilities, 17 files). Fixed.**
`@elirobinson/tokens/tailwind.css` defined no `@custom-variant dark`, so Tailwind fell back
to its default `dark` variant — `@media (prefers-color-scheme: dark)`. This system's dark
dial is `[data-theme="dark"]` on `<html>`, which that default does not match, so **every
`dark:`-prefixed utility in the vendored tree was dead**, answering to the reader's
operating system rather than to the dial.

That was the direct cause of 18 of the 24 contrast findings. `code-block.tsx` sets
`dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]` to swap shiki to its dark
theme; the swap never happened, so github-light token colours were painted on the dark
surface — measured at **1.43:1** (`#24292e` on `#000000`), **1.58:1** and **3.33:1** in
`agent`, `code-block` and `tool`.

The bridge now declares the variant, so those utilities fire and all three components
stopped failing. They have been deleted from `CONTRAST_OWNED_ELSEWHERE` — the gate below
went red and said to, which is the second direction working. The fix repairs far more than
contrast: 89 utilities' worth of dark-theme intent across the tree, plus every `dark:`
class a consumer writes.

**2. `text-muted-foreground/60` fails AA in both themes. Still open.**
`transcription.tsx` paints an unplayed segment at 60% of `--fg-3`. Measured **2.31-2.32:1**
in light and **3.27-3.28:1** in dark, against 4.5:1. The opacity modifier is the problem,
not the token: `--fg-3` on its own passes. It varies slightly by palette (ember and
miltinson 3.27, slate 3.28), so it is not a single-palette accident.

Both are gated rather than ignored. `elements.a11y.spec.ts` lists the still-open components
in `CONTRAST_OWNED_ELSEWHERE` and asserts **in both directions**: a contrast finding in any
other component fails, and a listed component that has _stopped_ failing also fails, with a
message saying to delete the entry. It cannot rot into a suppression list — cause 1 is the
proof, since the list is what forced its removal rather than letting it sit there passing.
Only `transcription` remains.

## Two things that are not accessibility findings

Recorded here because the sweep is what surfaced them and they belong to whoever owns the
package.

- **`TerminalContent` does not mount under a Rolldown/Vite bundler.** It renders `<Ansi>`
  from `ansi-to-react`, a CJS-only package (`main: lib/index.js`, no `exports`), and the
  default import comes back as an object — React error #130 before anything renders. The
  harness mounts `Terminal` without it and says so in a comment; the cost to this audit is
  the terminal's scrollback text, since every control Terminal has is in its header.
- **Several components type their props as the element they render.** `SourcesProps` is
  `ComponentProps<"div">` while `Sources` is a Radix `Collapsible`, so `defaultOpen` is a
  real, load-bearing prop the declared type does not admit. The fixtures spread it through
  a typed helper rather than reaching for `any`; upstream fixing the type would need no
  change here.

## The one control that is not fixed

`.react-flow__attribution a`, 51x13, in the six canvas-family components. It is React
Flow's own licence notice, painted by `<ReactFlow>`; it appears in no vendored class string,
so the transform layer cannot reach it, and React Flow's licence requires it to stay unless
a consumer holds a Pro subscription (`proOptions.hideAttribution` is the paid opt-out, not
an accessibility fix). Resizing a third party's licence notice is not a trade this audit
gets to make on a consumer's behalf.

It is excluded by a named selector at the call site in `elements.a11y.spec.ts` — which is
what `checkTouchTargets`' own docblock prescribes for a genuine exception, "where the
exception is visible in the test and reviewable, instead of hiding in an attribute on the
element" — and recorded in `contracts.json` as `react-flow-attribution`, so a consumer
rendering an Elements canvas knows why their own sweep reports it and what to do.
