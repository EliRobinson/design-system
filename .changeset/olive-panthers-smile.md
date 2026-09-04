---
'@elirobinson/eslint-config': minor
'@elirobinson/ai-elements': minor
'@elirobinson/tokens': minor
---

AI Elements renders in Miltinson colours, and a lint rule keeps it that way.

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
