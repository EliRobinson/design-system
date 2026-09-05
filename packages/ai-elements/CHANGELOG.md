# @elirobinson/ai-elements

## 0.3.0

### Minor Changes

- ba29d44: Add named variants beside the default fixtures: `variants` in `@elirobinson/ai-elements/fixtures`.

  The accessibility audit wants exactly one mount per component — two of its four
  checks are about a control's neighbours, so a gallery would measure the
  harness's layout rather than the component. Documentation wants the opposite:
  a tool pending, running, and errored are the states a reader is choosing
  between when deciding whether to use it. `variants` is keyed by the
  component's name in the manifest, then by a label naming the state, and sits
  beside the existing one-mount-per-component `fixtures` rather than replacing
  it. A component with nothing worth showing twice is simply absent from the
  map.

- 4b4b63f: Publish the reference fixtures as `@elirobinson/ai-elements/fixtures`.

  One realistic mount per vendored component, keyed by the component's name in
  the manifest and imported through the package's own published subpaths. They
  were already written — the accessibility audit runs on them — and they were
  reachable only from inside this repo. Exporting them gives the docs site and a
  consuming app the same mounts the audit measures, so a demo cannot drift from
  what was actually verified.

- 81e9f33: Vendored AI Elements now meets this system's touch-target and focus contracts, and
  `checkFocusVisible()` no longer reports a false violation on a control that already had
  focus.

  **The audit.** All four browser-settled contracts —
  `checkTouchTargets`, `checkHitAreaOverlap`, `checkFocusVisible`, `checkContrast` — were
  run over all 48 vendored components in both themes, all three palettes and both platform
  settings: 576 measurements. The baseline found 61 controls below the 44x44 floor across 39
  components, 2 focus-visible reports, 0 hit-area overlaps, and 24 contrast findings.

  **Touch targets.** shadcn/Radix draws controls at 32-40px, which clears WCAG 2.2 AA
  (SC 2.5.8, 24x24) and misses this system's 44x44 default, which is AAA (SC 2.5.5). Every
  affected control was classified individually against one of the two floors —
  17 primary, 11 dense — and the verdicts are published, with the geometry that was measured
  and the reason each is not the other, in `contracts.json` under `vendoredElementTargets`.
  `ds contracts` prints them. Nothing is exempted from measurement: a dense control is held
  to `var(--target-min)` (24x24) and reported under `touch-target-dense` if it misses.

  The default is the strict floor. `ui/button.tsx` carries a
  `not-data-[touch-target=dense]` guarded `var(--target)` minimum, so a control nobody has
  classified is measured strictly rather than quietly excused, and each relaxation is a named
  entry with an argument attached. Two controls were below the dense floor as well and had no
  tier to fall back into: the dialog's close button at 16x16, whose hit area now grows around
  an unchanged 16px glyph, and the citation rows in `sources.tsx` at 16px tall.

  Applied through a new, single-purpose rule in the transform layer
  (`scripts/ai-elements-patches/a11y.mjs`), so no vendored file is hand-edited and every
  change stays attributable across an upstream bump. Its anchors are exact and a miss is
  fatal: `pnpm sync:elements` stops and names the control rather than dropping the fix and
  reporting a clean bump. `NOTICE` gains the matching Apache-2.0 §4(b) paragraph.

  **`checkFocusVisible()` fix, which is not specific to Elements.** A control that already
  held focus when the sweep reached it was snapshotted in its focused state, so `.focus()`
  changed nothing and its perfectly good focus ring was reported missing. Radix's Dialog
  moves focus to its close button on open, so every open dialog on any page produced one of
  these. The check now blurs such a control before taking the `before` snapshot, in both the
  programmatic and the keyboard branch. This is the mirror of the inert-control guard the
  function already had: a probe that could not run must not be reported as a result.

  **Colour is unchanged and is not fixed here.** The sweep left 24 contrast findings, all in
  dark theme, all owned by the token bridge rather than by this package. 20 of them trace to
  one cause: `@elirobinson/tokens/tailwind.css` declares no `@custom-variant dark`, so
  Tailwind's default `dark` variant does not match this system's `[data-theme="dark"]` dial
  and all 89 `dark:` utilities in the vendored tree are inert — including the ones that swap
  syntax highlighting to its dark theme, which is why highlighted code measures as low as
  1.43:1 on a dark surface. They are gated, not ignored: the audit spec fails on a contrast
  finding anywhere else, and also fails when a listed one is fixed, telling you to delete the
  entry.

  **Runnable.** `pnpm a11y:elements` builds the package, builds the harness and runs the
  sweep. The component roster comes from `@elirobinson/ai-elements/manifest`, so a component
  a future upstream release adds arrives in the sweep by itself and arrives failing rather
  than unnoticed.

### Patch Changes

- 7338288: `Conversation` now scrolls instantly rather than smoothly by default.

  It is a `role="log"`, it scrolled itself with an animation on mount and on
  every content resize, and nothing in the vendored tree reads
  `prefers-reduced-motion`. An instant jump has no motion to reduce. Upstream
  spreads `{...props}` last, so `<Conversation initial="smooth" resize="smooth">`
  restores the previous behaviour — this changes the default, not the API.

- 58f3ba8: The `./fixtures` subpath is now documented, including what about it is stable.

  It was published with no mention in the README, and the manifest cannot reach it —
  `generate-manifest.mjs` walks `components/`, `ui/` and `lib/` only — so "read the manifest"
  found nothing. The README now names the subpath, its two exports, the second `@source`
  Tailwind needs for `dist/fixtures`, and the semver line: the subpath and the key shape are
  API, a fixture's internal composition and a variant label are not.

  The provenance section no longer claims `NOTICE` is generated. It is not; a check in the
  source repository holds it against the transform layer's rule ids instead.

- 85c3b50: Fix three reference fixtures that were not rendering what they composed: two produced an
  empty box, and one silently dropped its title.

  `fixtures/index.tsx` says in its own header that a fixture rendering no
  controls is how an audit ends up green without having looked at anything. Two
  of these were doing exactly that; the third was measuring and photographing a
  composition it did not actually contain. None of it surfaced until the
  documentation site started mounting them where a person could see them:
  - `confirmation` passed no `approval`, and `<Confirmation>` returns `null`
    without one — so nothing rendered at all.
  - `attachments` mounted the default `grid` variant with no `AttachmentPreview`
    and no `AttachmentInfo`, and an `<AttachmentRemove>` that returns `null`
    without an `onRemove` — a 96px tile with nothing in it. It is now the `list`
    variant, fully composed, which is also the variant whose remove button is
    visible rather than revealed on hover.
  - `plan` nested `PlanTitle` inside `PlanTrigger`, which spreads its props into
    a `<Button>` that already has JSX children — so the title was silently
    dropped. `PlanTitle` is now a sibling, with the trigger in a `PlanAction`.

  `pnpm a11y:elements` passes 576 with all three fixed, now over controls that
  are actually in the DOM.

  `variants` also gains a `Closed` mount for `context`, `inline-citation` and
  `model-selector`. Their default mounts are open, which is right for the audit —
  each has a page to itself — but a Radix dialog or hover card renders into a
  portal on `document.body`, so an open-by-default one inside a documentation
  page lands on top of the page instead of inside the demo. The default mounts
  are unchanged.

- 2a0f70c: Fix two more reference fixtures that mounted to zero height, in the same class as the three
  already fixed.

  Both rendered an empty box: the visual sweep reported a `1280x0` capture region for each,
  and the accessibility sweep passed over them with nothing in the DOM to measure — the false
  green `fixtures/index.tsx` warns about in its own header, where the "576 passed" is a test
  count that does not move with what a fixture actually renders.
  - `jsx-preview` mounted a bare `<JSXPreview jsx={…} />`. `JSXPreview` is only the context
    provider and a `relative` wrapper; the `jsx` string it is handed is never parsed until a
    `<JSXPreviewContent />` sits inside it. The fixture now composes the pair a consumer
    writes, `<JSXPreviewContent />` alongside the `<JSXPreviewError />` that surfaces a bad
    string.
  - `panel` mounted a bare `<Panel>`. It wraps React Flow's own `Panel`, which is an overlay —
    `.react-flow__panel` is `position: absolute` in `@xyflow/react`'s stylesheet — so on its
    own it leaves the flow entirely and the page around it measures zero. It is now mounted
    inside a `Canvas`, which is the only way upstream documents it and matches how `controls`,
    `node` and `edge` are already mounted here.

  `pnpm a11y:elements` passes 576 with both fixed, now over content that is actually rendered.

- c712bef: `NOTICE` now lists the `reduced-motion` rule, so its Apache-2.0 §4(b) modification list is
  complete again.

  The rule landed in the transform layer and really does modify
  `src/components/conversation.tsx`, but `NOTICE` — which ships in the tarball and says its
  list of modifications is "in full" — still named only four rules. That is a false §4(b)
  statement in a published artifact, not a docs nit.

  Nothing was generating or checking `NOTICE`; the standing docs claimed otherwise.
  `scripts/ai-elements-layer.test.mjs` now asserts every id in the layer's `ruleIds` appears
  in `NOTICE`, and re-reads the vendored `conversation.tsx` for `initial="instant"` and
  `resize="instant"` so the motion patch cannot be deleted to force an upstream bump through
  while three documents go on saying it is there.

## 0.2.0

### Minor Changes

- df6d556: AI Elements renders in Miltinson colours, and a lint rule keeps it that way.

  **The bridge already did most of the work.** `@elirobinson/tokens/tailwind.css` maps
  Tailwind's colour, radius, shadow and font namespaces onto the tokens with
  `@theme inline`, so the utilities AI Elements is already written in —
  `bg-background`, `text-muted-foreground`, `border-border`, `rounded-md` — compile to
  `var(--token)` and answer to all three dials at runtime. Measured over the pinned
  release: all 191 distinct colour and radius classes the vendored tree uses compile
  under the bridge, and every colour declaration they produce resolves through a token.
  No component source needed changing for that.

  **`dark:` now means the theme dial.** Tailwind's stock `dark` variant is
  `@media (prefers-color-scheme: dark)`, while this system themes on
  `[data-theme="dark"]`. Those were two independent switches: a theme toggle moved every
  token and none of the `dark:` utilities, and a reader whose OS was dark got the `dark:`
  half of a light page. `tailwind.css` now declares a `@custom-variant dark` pointing at
  `[data-theme="dark"]` and `.dark`, element and descendant, wrapped in `:where()` so
  specificity is unchanged. Every `dark:` class in a consuming app moves with the toggle
  from this version on, with no code change.

  **What the bridge could not reach is patched in the transform layer.** Two things
  defeat an alias: Tailwind's own palette (`text-zinc-400`, `bg-red-100
dark:bg-red-900/30`, `text-white`, `bg-black/50` — literals with a friendlier
  spelling, which nothing re-points), and shadcn/ui's `--accent`, which means "subtle
  hover tint" upstream and "Miltinson Amber" here, so `hover:bg-accent` on a ghost button
  rendered as a brand-amber wash. `scripts/ai-elements-patches/skin.mjs` rewrites both to
  tokens across 19 vendored files, always onto a pairing the token layer has measured —
  `bg-*-tint` with `text-*-ink` is 6.24:1 or better in every palette and theme,
  `bg-destructive` with `text-destructive-foreground` 5.41:1. Where a light literal and
  its `dark:` counterpart map to the same token the pair collapses to one class, because
  a token already carries both themes. No behaviour, geometry or API is touched, and no
  vendored file is hand-edited: it is a transform rule like the other two, re-applied on
  every `pnpm sync:elements` and reviewable as one file.

  **`no-hardcoded-design-values` now catches Tailwind's palette.** `text-zinc-500` is
  `bg-[#71717b]` with a friendlier spelling — a literal that survives a theme flip, a
  palette flip and a tokens bump unchanged — and the rule previously saw only the
  arbitrary-value form. Any colour utility naming one of Tailwind's 22 default ramps, or
  `white`/`black`, is now reported as a hardcoded colour, with the variant chain stripped
  so one `allow` entry covers every spelling of the same literal. Design system aliases
  are untouched: none of `bg-background`, `text-accent-ink`, `from-chart-1` or
  `border-warning-tint-edge` names a Tailwind ramp.

  That rule is what locks the skin. The repo now points it — and only it, and it has no
  fixer — at `packages/ai-elements/src`, so a literal colour reintroduced by an upstream
  bump fails `pnpm lint` instead of shipping.

## 0.1.0

### Minor Changes

- 6ae0243: New package: `@elirobinson/ai-elements`, AI Elements vendored from
  [`vercel/ai-elements`](https://github.com/vercel/ai-elements) at release
  `ai-elements@1.9.0` (`bc871264341cf54a7ea1fee36d951688ed2a1ff7`).

  It is a separate package rather than an addition to `@elirobinson/react` because
  `@elirobinson/react` has no UI dependencies at all, and Elements needs Tailwind v4,
  shadcn/ui, Radix and `lucide-react`. Folding them in would force Tailwind on every
  consumer of `Button` and `Input` for a feature most will not use. Installing this
  package is how a consumer opts into that requirement instead.

  Per-component subpaths, no barrel: `./components/*` (48 AI Elements), `./ui/*` (25
  shadcn/ui primitives they are built on), `./lib/*`. What exists and what each subpath
  exports is published as `./manifest`, regenerated from the emitted declaration files on
  every build; the upstream pin is published as `./upstream`. Neither is restated in prose
  anywhere, so neither can go stale.

  The vendored tree is Apache-2.0. The package ships `LICENSE`, a `NOTICE` crediting
  Vercel and enumerating the modifications, and a generated provenance header on every
  file naming the upstream release and that file's upstream path.

  Maintainers re-pull with `pnpm sync:elements`. Every vendored file is upstream's bytes
  plus the two transforms in `scripts/ai-elements-transforms.mjs` and nothing else, which
  is what lets the check attribute each difference it finds: upstream moved, or a vendored
  file was edited. When both are true of one file it exits non-zero and writes nothing,
  rather than silently reverting the local change.

  **Peer note.** The peers are `react`/`react-dom` `^19`, `tailwindcss` `^4`, `ai`
  `^6.0.105` and `@ai-sdk/react` `^3.0.41`. The `ai` peer is v6, not v7: `ai@7`
  restructured `LanguageModelUsage` (`reasoningTokens` and `cachedInputTokens` moved into
  `outputTokenDetails`/`inputTokenDetails`), and `components/context.tsx` at the pinned
  release reads the v6 shape. `ai-elements@1.9.0` is upstream's newest tagged release and
  still declares `ai: ^6.0.105` itself. `sync:elements` diffs upstream's dependency ranges
  against the lockfile on every run, so the move to v7 surfaces as a `DEP` line the day
  upstream makes it.
