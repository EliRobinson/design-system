# @elirobinson/ai-elements

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
