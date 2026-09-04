# AI Elements

`@elirobinson/ai-elements` is vendored from
[`vercel/ai-elements`](https://github.com/vercel/ai-elements) at a pinned release. It is
the only package here whose source is not ours.

## Why it is not part of `@elirobinson/react`

`@elirobinson/react` has zero UI dependencies — `@elirobinson/tokens` and two TanStack
packages. Elements needs Tailwind v4, shadcn/ui, Radix and `lucide-react`. Adding those to
`@elirobinson/react` would force Tailwind on every consumer of `Button` and `Input`, for a
feature most of them will not use. Installing the AI tier is how a consumer opts in.

## The one rule

**Never edit anything under `packages/ai-elements/src/`.** Every file there is written by
`pnpm sync:elements` from the pinned upstream release, and the tooling is built on that
being true:

- `scripts/sync-ai-elements.mjs` re-derives the expected bytes from fresh upstream bytes
  and compares. Because a vendored file is upstream plus a known transform and nothing
  else, every difference is attributable — upstream moved, or somebody edited the file.
- When both are true of one file it exits `2` and writes nothing, rather than silently
  reverting the local change. A hand edit therefore does not just get lost; it blocks the
  next bump of that file until someone reconciles it.
- `packages/ai-elements/src` is in `.prettierignore`, and the repo ESLint config keeps its
  general rule set off the tree, for the same reason: a formatter or an autofix run across
  it would register as 74 local edits and jam every future re-sync at once. Exactly one
  rule is pointed back at it, and it has no fixer — see "The skin" below.

A change we actually need goes in `scripts/ai-elements-transforms.mjs`, where it is
re-applied on every bump and reviewable as one file, or in a wrapper component in our own
package. As of `ai-elements@1.9.0` the transform layer is five rules, in this order.
Two are mechanical: `workspace-alias` rewrites upstream's `@repo/shadcn-ui/*` workspace
imports to paths inside the package, and `relative-extensions` adds `.js` to relative
specifiers. Then come the two that carry judgement — `a11y-touch-targets` and
`reduced-motion`, below — and last, the skin.

## The skin

`@elirobinson/tokens/tailwind.css` is what makes a vendored component render in Miltinson
colours with no edit to its source. It maps Tailwind's colour, radius, shadow and font
namespaces onto the tokens with `@theme inline`, so `bg-background`,
`text-muted-foreground`, `border-border` and `rounded-md` compile to `var(--token)` and
answer to all three dials at runtime. Measured over the pinned release: all 191 distinct
colour and radius classes the tree uses compile, and every colour declaration they produce
resolves through a token.

Two things defeat that, and `scripts/ai-elements-patches/skin.mjs` is the whole answer to
both:

- **Tailwind's own palette.** `text-zinc-500` and `bg-red-100 dark:bg-red-900/30` are
  literals with a friendly spelling. No alias re-points them, so they survive a theme
  flip, a palette flip and a tokens bump unchanged.
- **shadcn's `--accent`.** Upstream means "subtle hover tint"; this system means Miltinson
  Amber. `hover:bg-accent` is correct upstream and a brand-amber wash here.

Anything upstream adds later that the skin's tables do not cover reaches `src/` unchanged
and fails `pnpm lint`: `@elirobinson/no-hardcoded-design-values` is pointed at the vendored
tree from the root ESLint config. That is deliberate — a new literal failing loudly beats a
broad regex guessing a token for it. The `allow` list there is the pressure valve, and each
entry carries the reason it is not a token.

`dark:` is handled once, in the bridge rather than per file: `tailwind.css` declares a
`@custom-variant dark` pointing at `[data-theme="dark"]`, so the variant follows the
system's dial instead of the reader's operating system. Every `dark:` utility upstream
ships — and every one a consumer writes — moves with the theme toggle because of it.

## The two rules that carry judgement

`a11y-touch-targets` is third of the five, after the two specifier rules and before the
skin. It lives in its own module, `scripts/ai-elements-patches/a11y.mjs`. Every entry there
names one control, the geometry a browser measured for it, which of the two touch-target
floors it was held to, and why it is that one and not the other — see
[AI Elements accessibility](ai-elements-accessibility.md) for the audit that produced them
and `contracts.json`'s `vendoredElementTargets` for the published list.

`reduced-motion` is fourth, and lives in `scripts/ai-elements-patches/motion.mjs`. It is
one finding: `Conversation` is a `role="log"` that scrolls itself smoothly on first paint
and on every content resize, and nothing in the vendored tree reads
`prefers-reduced-motion`, so the vendored copy defaults both to `"instant"` instead.
`{...props}` is spread last upstream, so `<Conversation initial="smooth">` puts the
animation back — the default moves, the API does not. It is a separate module and a
separate rule from `a11y.mjs` on purpose: that file's ids are pinned name-for-name to
`contracts.json`'s `vendoredElementTargets`, and a live region's scroll behaviour is not a
control with a size, so it has no touch-target floor and no honest verdict to publish
there. The module's header carries the full argument.

Both modules' anchors are exact and their misses are fatal. A patch whose anchor no longer
appears throws **by name** during `pnpm sync:elements` rather than quietly not applying, so
an upstream bump that moves one of these class strings or attributes stops and tells you
which control to re-measure. That is the intended failure: a dropped accessibility or
motion fix that reports a clean bump is the outcome the whole arrangement exists to
prevent. The fix is a new anchor, never a deleted patch entry — `ai-elements-layer.test.mjs`
in `scripts/` re-reads the vendored `conversation.tsx` for `initial="instant"` and
`resize="instant"` so that deleting the motion patch to get a bump through goes red.

## Re-syncing

```bash
pnpm sync:elements                  # check the pin against the newest upstream release
pnpm sync:elements --write          # vendor it and re-pin elements.lock.json
pnpm sync:elements --ref <tag|sha>  # target a specific upstream ref
pnpm sync:elements --pinned         # re-check the pinned ref rather than the newest
```

It reports six things, and the exit code says which mattered: `UPSTREAM` (a diff),
`CONFLICT` (exit 2), `LOCAL EDIT`, `ADDED`, `REMOVED`, `HEADER`, and a `DEP` line per
upstream dependency range that moved. `--write` picks up components upstream added — the
component list is discovered from the upstream tree, and the shadcn/ui primitives from
the transitive closure of their imports, so neither is a list anyone maintains here.

### What a bump does not check

`sync:elements` compares bytes. It knows nothing about behaviour, and it exits 0 having
verified none of the following — each is a handover note, not a test:

- **The seven family pages under `/components/ai-elements`** (`conversation`, `reasoning`,
  `tools`, `sources`, `artifacts`, `planning`, `prompt-input`, plus `overview`,
  `installation` and `examples`) make on the order of ninety behavioural claims — what a
  component does on stream, what it renders when a prop is absent, which element carries
  the live region — that were written true against the pinned release and are unverified
  again the moment it moves. Nothing enumerates them. Re-read them after a bump.
- **The fixtures under `packages/ai-elements/fixtures/`** are hand-composed against
  upstream's prop shapes. A renamed prop compiles-errors; a re-interpreted one does not.
- **`NOTICE`'s modification paragraphs** — see Licensing below.

## What is published, and what must not be restated

The component roster is `dist/manifest.json`, generated from the emitted declaration
files on every build and exported as `@elirobinson/ai-elements/manifest`. The upstream pin
is `elements.lock.json`, exported as `@elirobinson/ai-elements/upstream`. Per the root
rule, no doc, template or comment may list the components — point at the manifest.

The audit fixtures are published too, as `@elirobinson/ai-elements/fixtures` — the same
render inputs the a11y sweep drives every control with, built from `fixtures/` to
`dist/fixtures/`. They are **not** in the manifest: `generate-manifest.mjs` walks
`components/`, `ui/` and `lib/` only, so "read the manifest" does not reach them. See
`packages/ai-elements/README.md` for the published surface and what is and is not stable
about a fixture.

## Licensing

The vendored tree is Apache-2.0. The package ships `LICENSE` (the licence text), `NOTICE`
(attribution to Vercel and shadcn, plus the complete list of modifications required by
§4(b)), and a generated provenance header on every vendored file naming the upstream
release and that file's upstream path. The per-file headers are generated from the same
lockfile as the vendored bytes, so they cannot drift. **`NOTICE` is not generated.** It is
hand-written prose, and its "in full" modification list is only true because somebody keeps
it true: if the transform layer gains a rule, `NOTICE` must gain the matching paragraph in
the same commit. The one thing checking that is `scripts/ai-elements-layer.test.mjs`, which
asserts every id in `ruleIds` appears somewhere in `NOTICE`. That catches a missing rule; it
cannot tell you the paragraph you wrote is accurate. Read the four beside it and match them.

## Two things that will surprise you

- **The `ai` peer is v6, not v7.** `ai@7` restructured `LanguageModelUsage`, and
  `components/context.tsx` at the pinned release reads the v6 shape.
  `ai-elements@1.9.0` is upstream's newest tagged release and declares `ai: ^6.0.105`
  itself. `sync:elements` diffs upstream's ranges on every run, so the move surfaces as a
  `DEP` line the day upstream makes it.
- **The package is excluded from `tsconfig.typecheck.json`.** It needs `lib: ES2023` for
  `Array.prototype.toReversed`, and the root sweep is a single flat program. It is still
  fully typechecked: its `build` is `tsc -p` against its own config with `strict` on and
  no check relaxed, and `pretypecheck` runs every build first.
