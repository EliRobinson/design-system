---
name: design-system
description: Use when building, changing, or reviewing any UI in this repo — pages, screens, layouts, components, styling, colors, typography, spacing, dark mode, accessibility, or "make it look like X". Establishes @elirobinson/react, @elirobinson/tokens, and @elirobinson/ai-patterns as the primary source of components, tokens, design patterns, and UI contracts, and shows how to discover what the installed versions offer.
---

# Design System First

All UI in this repo is built from **`@elirobinson/react`** (components, hooks), **`@elirobinson/tokens`** (color, type, space, radius, shadow, motion), and **`@elirobinson/ai-patterns`** (the contracts and patterns you build under). Never a second component library. Never hardcoded design values.

Upstream source of truth: https://github.com/EliRobinson/design-system

## Step 1 — Ask the packages, don't guess

Run these **before** writing UI. They read `node_modules` at run time, so they match the installed versions exactly — including the component directory layout, which is discovered rather than assumed:

> If `ds` prints `node_modules disagrees with the lockfile` on stderr, stop and run your package manager's install first. It is describing versions that are installed here but are not what CI builds, so code written against them will fail there. `ds-resync` reports the full picture.

```bash
pnpm ds                  # components (+ exports & variants), hooks, typography classes, token groups
pnpm ds props <Name>     # props and variant unions; accepts `Card` or `molecules/Card`
pnpm ds tokens [filter]  # tokens and their values
pnpm ds classes [filter] # CSS classes the design system ships
pnpm ds contracts        # machine-checkable rules your UI must satisfy — read this every time
pnpm ds patterns         # working principles
pnpm ds prompts [name]   # reusable prompt templates
```

If `pnpm ds` is not wired up as a script, `pnpm exec elirobinson-ds` is the same command.

Any component list you remember, or that appears in a doc, may be out of date. `pnpm ds` is the authority — see the **Discover, Don't Document** pattern in `pnpm ds patterns`. For deeper detail read the component source under `node_modules/@elirobinson/react/src/components/` and `node_modules/@elirobinson/tokens/src/tokens.css`.

## Step 2 — Compose

`pnpm ds props <Name>` prints the exact import line to copy. It looks like this:

```tsx
import { Button } from '@elirobinson/react/components/atoms/Button';
```

- Per-component imports naming the full subpath. There is no barrel export; a bare `@elirobinson/react` import does not resolve.
- Drive appearance with the component's own `variant` / `size` props, not by overriding with utilities.
- Use utility classes for **layout** (grid, flex, spacing), the design system for **look**.
- `@elirobinson/tokens/tokens.css` and `@elirobinson/react/styles.css` are imported once, in the app shell, in that order — never per component.
- Token overrides go in an **unlayered** `:root` block — `tokens.css` is unlayered, so an override inside `@layer base` silently loses to it. With `next/font`, re-point the families through `--ds-font-sans-override` / `--ds-font-mono-override` instead, with the font class on `<html>`.
- Patterns like heroes, page headers, empty states, and sidebars are **compositions** of primitives, not missing components.

## Step 3 — Use tokens, never literals

In order of preference:

1. Token-backed utilities, if this repo maps them. With Tailwind v4 that mapping is one line — `@import '@elirobinson/tokens/tailwind.css'` — which is what makes `bg-background`, `text-muted-foreground`, `border-border`, `text-accent`, `ring-ring` resolve to system tokens.
2. Typography classes: run `pnpm ds classes t-` for the current set.
3. Arbitrary values referencing a token: `text-[var(--fg-2)]`, `gap-[var(--space-6)]`, `shadow-[var(--shadow-md)]`, `duration-[var(--dur-fast)]`.

**Forbidden:** hex / `rgb()` / `oklch()` literals, magic px for radius, shadow, and motion, and ad-hoc font-size stacks where a `.t-*` class exists. `@elirobinson/eslint-config` fails the build on these.

Dark mode is `[data-theme="dark"]` (with `.dark` accepted as a compatibility alias). If this repo uses `next-themes`, it must be configured with `attribute="data-theme"` — the library's default `class` strategy is what makes dark mode silently do nothing.

## Step 4 — Satisfy the contracts

`pnpm ds contracts` prints `@elirobinson/ai-patterns`' rules as data. They are requirements, not suggestions, and each one carries its own `check` plus a `verifiedBy` naming the lint rule or test helper that enforces it. Read them from the command, not from a summary in a doc — the package is the authority.

The statically checkable ones are enforced by `@elirobinson/eslint-config`. The ones only a browser can settle — touch targets, visible focus, WCAG AA contrast — are enforced by the Playwright helpers in `@elirobinson/ai-patterns/testing/playwright`.

## Step 5 — When something is missing

Stop at the first rung that works:

1. Compose it from existing primitives.
2. Pull in a sanctioned gap-filler (in a shadcn/ui repo: `pnpm dlx shadcn@latest add <component>`, then restyle with tokens).
3. Hand-roll from tokens — last resort, and say so in your summary as a **design system gap** worth upstreaming.

Foreign UI libraries (MUI, Chakra, Ant Design, Mantine, HeroUI, Headless UI, DaisyUI), direct Radix imports, and bare `@elirobinson/*` imports are blocked by ESLint. Do not work around the ban — pick a rung above.

Contributing a component upstream instead? `pnpm ds prompts add-component` prints a fill-in-the-blanks template for exactly that.

## Before you call UI work done

Run `pnpm ds patterns` and follow the **Definition of Done for UI work** checklist it prints. It lives in the package so it stays current; do not copy it into this file.
