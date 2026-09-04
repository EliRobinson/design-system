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
package. As of `ai-elements@1.9.0` the transform layer is three rules. Two are mechanical:
rewriting upstream's `@repo/shadcn-ui/*` workspace imports to paths inside the package,
and adding `.js` to relative specifiers. The third is the skin.

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

## What is published, and what must not be restated

The component roster is `dist/manifest.json`, generated from the emitted declaration
files on every build and exported as `@elirobinson/ai-elements/manifest`. The upstream pin
is `elements.lock.json`, exported as `@elirobinson/ai-elements/upstream`. Per the root
rule, no doc, template or comment may list the components — point at the manifest.

## Licensing

The vendored tree is Apache-2.0. The package ships `LICENSE` (the licence text), `NOTICE`
(attribution to Vercel and shadcn, plus the complete list of modifications required by
§4(b)), and a generated provenance header on every vendored file naming the upstream
release and that file's upstream path. All three are generated or checked from the same
lockfile, so none can drift from the code. If the transform layer gains a rule, `NOTICE`
must gain the matching paragraph.

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
