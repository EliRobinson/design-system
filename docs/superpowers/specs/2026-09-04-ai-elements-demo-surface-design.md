# AI Elements demo surface — design

Date: 2026-09-04
Cards: P2, C1–C7
PR: #228 (`docs/ai-elements-section`)

## Problem

`@elirobinson/ai-elements` ships 48 vendored components and 25 shadcn/ui
primitives. The docs site documents them as prose plus a generated index. Nothing
on the site renders one. A reader cannot see what they are installing, and the
visual suite has never shot a vendored component.

Upstream's own docs at `elements.ai-sdk.dev` describe the unskinned, unpatched
components, so they are actively wrong for our copy.

## What already exists

Three facts settled the shape of this design, and all three were discovered by
reading rather than assumed.

1. **The fixture surface P2 asks for is built.** `packages/ai-elements/a11y/fixtures/index.tsx`
   is 937 lines: one realistic mount per vendored component, keyed by the
   component's name in the manifest, imported through the package's published
   subpaths, rendered against the exact three-import stylesheet a consumer is
   told to write. A1 built it to run the touch-target audit. It is not reachable
   from the docs app.

2. **`apps/docs` has no Tailwind.** No PostCSS config, one `site.css`, and no
   page imports a vendored component for rendering — the existing worked
   examples are read off disk and displayed as source, never mounted. Wiring
   Tailwind 4 into the docs app is the actual prerequisite for everything else.

3. **The vendored `Conversation` spreads `{...props}` last.** `role`, `initial`
   and `resize` are all overridable by a consumer today. The gap is not the API,
   it is the defaults.

## Decisions

### C1 — which implementation wins

Approved by the human partner on 2026-09-04.

| Concern          | Winner                           | Reasoning                                                                                                                                                                               |
| ---------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thread           | Elements' `Conversation`         | `use-stick-to-bottom` already implements "follow only a reader who is at the bottom", which is the substance of `ChatThread`'s 32px threshold and pre-commit `scrollHeight` capture.    |
| Turn             | Elements' `Message`              | Handles `UIMessage` roles, markdown via Streamdown, and branch navigation. `ChatMessage` handles avatar, name and timestamp. Theirs is the larger surface and the one the AI SDK feeds. |
| Streaming marker | Ours — `StreamingCaret` survives | `Shimmer` animates a gradient across a string of text. A caret marks the insertion point in text that is still arriving. Different jobs; neither replaces the other.                    |

`Conversation`'s defaults are `initial="smooth"` and `resize="smooth"` — animated
motion inside a `role="log"` region, with no reduced-motion handling anywhere in
the vendored tree. That is the one real regression against `ChatThread`, whose
instant scroll assignment exists precisely so there is no motion to reduce. It is
two anchored string replacements, so it goes in the transform layer as a patch,
not into a wrapper.

`aria-live` needs no patch. `role="log"` is set before the spread, so a consumer
writes `<Conversation aria-live="polite" aria-relevant="additions text">` and it
takes. `ChatThread`'s `announce` prop was the ergonomic form of that, and its
loss is a documentation cost, not a capability cost. The C1 demo page states it.

`ChatThread`, `ChatMessage` and `StreamingCaret` are published at v3.2.1.
**Deprecate, never delete.** `@deprecated` JSDoc on `ChatThread` and
`ChatMessage` pointing at the vendored subpath, a deprecation note on both docs
pages, removal deferred to the next major. `StreamingCaret` is untouched.

Card #122, the dark-theme `ChatThread` visual flake, retires with `ChatThread`.
Close it deliberately when the deprecation lands, referencing this decision.

### Baseline coverage

All 48 vendored components get a shot in both themes, taken off the fixture route
rather than off a demo page. Approved by the human partner. This is what P2's
"done when" asks for and the fixtures already exist, so the cost is baseline
churn and flake surface rather than authoring time.

### Demo page granularity

Seven pages, one per card C1–C7, covering the 22 components those cards name. The
remaining 26 stay in the generated index. A page per component would be 48 pages
restating the index; the cards' groupings are the editorial judgement about which
components are understood together.

## Architecture

Five pieces, built in this order. Each is usable before the next exists.

### 1. Tailwind 4 in `apps/docs`

`@tailwindcss/postcss` plus a `postcss.config.mjs`, and a new stylesheet carrying
the three imports in the order `@elirobinson/tokens/tailwind.css` documents:

```
@import 'tailwindcss';
@import '@elirobinson/tokens/tokens.css';
@import '@elirobinson/tokens/tailwind.css';
```

Plus a `@source` naming the vendored tree, without which Tailwind never scans it
and every utility the components use is dropped from the build. The exact
relative path is settled during implementation rather than guessed at here: pnpm
symlinks the workspace package, so the path that works from the harness does not
transfer, and a `@source` that silently matches nothing is exactly the failure
this whole section is about.

A new file imported by the docs root layout, not an edit to `site.css`. `site.css` is the docs chrome and its
cascade is load-bearing for every existing shot; keeping the two apart means a
Tailwind regression cannot be confused for a chrome regression.

`packages/tokens/src/tokens.css` is not touched. Two tests in two packages pin
its `@layer base` behaviour.

**Verification is not optional here.** `next build` hides CSS warnings on stderr
and behind a warm `.next`. The existing docs baselines must be seen to pass
after this change against a cold build, and a deliberately broken variant must be
seen to fail, before the wiring is trusted.

### 2. The shared fixture module

`packages/ai-elements/a11y/fixtures/` moves to `packages/ai-elements/fixtures/`,
a sibling of `src/`, compiled into `dist/fixtures/` and exported as
`./fixtures`.

**Not under `src/`.** `pnpm sync:elements` re-derives every file under `src/`
from upstream bytes; a new directory there reads as local divergence and jams the
next bump.

The module exports two things:

- `fixtures` — the existing map from manifest component name to a default mount.
  Unchanged contract, so `packages/ai-elements/a11y` keeps working with an import
  path edit and nothing else.
- `variants` — a map from component name to named extra mounts: tool states,
  mid-stream snapshots, empty states, error states. Demo pages read these. The
  fixture route does not shoot them.

Exporting `./fixtures` publicly is deliberate. The docs app already imports
`@elirobinson/ai-elements/manifest`, one roster with two readers is the pattern
this repo enforces everywhere, and a consumer adopting the tier gets working
reference mounts out of it. Every dependency the fixtures import is already a
dependency or peer of the package.

### 3. The fixture route

A static route under the docs app, one page per fixture, expanded by
`generateStaticParams` from the manifest. `apps/docs/scripts/assert-static-routes.mjs`
fails the build on any server-rendered route, so this must be static, and a
`generateStaticParams` route satisfies it via `prerender-manifest.json`'s
`dynamicRoutes`.

Motion is frozen two ways, because CSS alone does not stop it:

> **As shipped, both bullets below are stronger than what they specify. Recorded
> here rather than rewritten silently, since the difference is deliberate.**

- The route wraps its mount in `<MotionConfig reducedMotion="always">` from
  `motion/react` — `"always"`, not the specified `"user"`. `Shimmer` animates
  through Framer Motion's Web Animations path, which `animation: none` in CSS
  does not reach, and these pages exist to be photographed: keying the freeze to
  the viewer's OS setting would have made the baseline depend on the machine.
- No Playwright project sets `reducedMotion` — none was added, and the route
  does not depend on one. `fixtures.css` kills `animation` and `transition`
  inside `.fixture-stage` **unconditionally**, not under a
  `prefers-reduced-motion: reduce` media query. Same reason: a media-query guard
  is only as reliable as the emulation setting that triggers it. It is scoped to
  the fixture stage rather than applied site-wide, because the docs site's own
  motion is already handled in `tokens.css`.

The vendored tree still has no `prefers-reduced-motion` guard of its own, and
that is the gap `scripts/ai-elements-patches/motion.mjs` closes for the one
component where it was a defect rather than a decoration — see §5.

### 4. Seven demo pages

`/components/ai-elements/<family>` for each of C1–C7. Each page carries:

- **A live demo**, mounted from the shared fixture module. Fed a canned
  `UIMessage[]`, never a live model. A live model is not deterministic and the
  visual suite cannot shoot it.
- **The exact import subpath**, which the existing guard test already resolves in
  a real Node subprocess.
- **What we patched and why**, generated — never retyped — from
  `scripts/ai-elements-patches/a11y.mjs`, `skin.mjs`, and `contracts.json`'s
  `vendoredElementTargets` (an object of 30 patch entries plus a `policy` key,
  each carrying a verdict, the measured geometry, and the reason it is that
  verdict and not the other).

The families are declared in `apps/docs/src/lib/ai-element-families.ts`, in the
shape the guard test's existing `NAMEABLE` table already uses: each entry names
its components and the card they come from. A test asserts every named component
exists in the manifest, that no component appears in two families, and that every
family renders. The table is explicitly a subset, not a roster — the index covers
all 48 and remains the only complete list.

### 5. The C1 patch and deprecation

Two anchored replacements in `conversation.tsx`. **As shipped these went in a new
module, `scripts/ai-elements-patches/motion.mjs`, under a new transform rule
(`reduced-motion`), not into `a11y.mjs`** — that file's ids are pinned name-for-name
to `contracts.json`'s `vendoredElementTargets`, whose every entry is a control
measured against one of two touch-target floors, and a live region's scroll
behaviour has no floor and so no honest verdict to publish there. The module's
header carries the argument. `assertPatch` fails loudly if upstream moves either
string, exactly as specified.

`use-stick-to-bottom` accepting `"instant"` for `initial` and `resize` is
**asserted, not assumed**: verified against the installed version's types before
the patch is written, and covered afterwards by
`scripts/ai-elements-layer.test.mjs`, which re-reads the vendored
`conversation.tsx` for both attributes. That is the second pin — `assertPatch`
catches upstream moving the anchor, and this catches the patch being deleted to
force a bump through.

## Testing

| What                           | How                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import subpaths resolve        | Existing `apps/docs/src/lib/ai-elements.test.ts`, extended. Real Node subprocess — an in-process resolve check silently passes on everything, including `react`. |
| No page writes down the roster | Existing guard, extended so a demo page may name only subpaths in its own family. Not weakened.                                                                  |
| Fixtures cover every component | Existing `pnpm a11y:elements` — the harness reports "no fixture named …" as a fixture error and the spec asserts on it first.                                    |
| Touch targets and focus        | `pnpm a11y:elements`, currently 576 assertions passing.                                                                                                          |
| Vendored tree unmodified       | `pnpm sync:elements --pinned` must exit 0.                                                                                                                       |
| Visual                         | ~96 fixture shots plus ~14 demo-page shots, both themes.                                                                                                         |
| Types                          | `pnpm typecheck`. The root typecheck has no `@/` alias, so no `@/` imports outside the docs app's own tsconfig.                                                  |

A changeset is required — this touches `packages/ai-elements` and
`packages/react`. Changes confined to `apps/docs` do not need one, but this work
is not confined there. The changeset file must be `git add`ed to count.

## Risks

- **~110 new baselines.** CI mints baselines for genuinely new shots. The
  `visual-accept` label accepts once, on the run it is applied to, and
  regenerates whatever failed in that run — so the accept commit's file list gets
  read before merge, every time, or an unrelated flake gets swallowed.
- **`TerminalContent` throws React #130** under Rolldown/Vite: an `ansi-to-react`
  CJS default-import interop failure. Its fixture and any terminal demo will
  break. Out of scope to fix; the fixture route must fail loudly on it rather
  than shooting a blank, and the failure is reported, not worked around.
- **`transcription` fails AA contrast** (2.31:1 light, 3.27:1 dark), gated in
  `elements.a11y.spec.ts`. The gate is not suppressed. The contrast gate asserts
  in both directions, so if a colour fix makes a listed component stop failing,
  its entry is deleted rather than left in place.
- **Tailwind disturbing the `site.css` cascade.** Mitigated by a separate
  stylesheet and by requiring a cold-build baseline failure before trusting a
  pass.

## Out of scope

- **The live playground** (P2 item 1). Decided with the human partner on
  2026-09-04. It lands later against the same fixture fallback and requires no
  rework here.
- **The tier-boundary taxonomy.** Card P1 owns it. `docs/agents/components.md`'s
  tier rules are not rewritten and nothing here claims the vendored set has an
  atomic tier. The `/components` placement stays reversible, the Tailwind 4
  requirement stays stated on that group, and the `/components` page's counted
  claim stays true.
- **Publishing anything publicly.** The registry is restricted, deliberately.
