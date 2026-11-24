---
name: design-system
description: Use when building, changing, or reviewing any UI in this repo: pages, screens, layouts, components, styling, colors, typography, spacing, dark mode, accessibility, or "make it look like X". Establishes @elirobinson/react, @elirobinson/tokens, and @elirobinson/ai-patterns as the primary source of components, tokens, design patterns, and UI contracts, and shows how to discover what the installed versions offer.
---

# Design System First

All UI in this repo is built from `@elirobinson/react` (components, hooks), `@elirobinson/tokens` (color, type, space, radius, shadow, motion), and `@elirobinson/ai-patterns` (the contracts and patterns you build under).

Upstream source of truth: https://github.com/EliRobinson/design-system

## Step 1: Ask the packages, don't guess

Run these before writing UI. They read `node_modules` at run time, so they match the installed versions exactly, including the component directory layout, which is discovered rather than assumed:

> If `ds` prints `node_modules disagrees with the lockfile` on stderr, stop and run your package manager's install first. The installed versions are not what CI builds, so code written against them will fail there. `ds-resync` reports the full picture.

```bash
pnpm ds                  # components (+ exports & variants), hooks, typography classes, token groups
pnpm ds props <Name>     # props and variant unions; accepts `Card` or `molecules/Card`
pnpm ds tokens [filter]  # tokens and their values
pnpm ds classes [filter] # CSS classes the design system ships
pnpm ds contracts        # machine-checkable UI rules to satisfy
pnpm ds patterns         # working principles
pnpm ds prompts [name]   # reusable prompt templates
pnpm ds check            # known traps that fail with no error; run after setup and every upgrade
```

If `pnpm ds` is not wired up as a script, `pnpm exec elirobinson-ds` is the same command.

A component list you remember, or one in a doc, may be out of date, so `pnpm ds` is the authority; see the Discover, Don't Document pattern in `pnpm ds patterns`. For deeper detail read the component source under `node_modules/@elirobinson/react/src/components/` and `node_modules/@elirobinson/tokens/src/tokens.css`.

## Step 2: Compose

`pnpm ds props <Name>` prints the exact import line to copy. It looks like this:

```tsx
import { Button } from '@elirobinson/react/components/atoms/Button';
```

- Import each component by its full subpath. There is no barrel export; a bare `@elirobinson/react` import does not resolve.
- Set appearance with the component's own `variant` / `size` props, not by overriding with utilities. Use utility classes for layout (grid, flex, spacing) only, because the design system owns the look.
- On Tailwind v4, order the CSS entry as `@import 'tailwindcss'`, then the design system stylesheet (`@elirobinson/react/styles.css`, or `@elirobinson/tokens/tokens.css` for an app that does not import `styles.css`), then `@import '@elirobinson/tokens/tailwind.css'`. That last import maps the Tailwind color namespace onto the tokens, so utilities like `bg-background` resolve to them.
- Import `@elirobinson/react/styles.css` once, in the app shell, not per component. On Tailwind v4 that is the CSS entry above. It already imports `@elirobinson/tokens/tokens.css`; importing `tokens.css` as well bundles it twice. An app that does not import `styles.css` (no React, or per-component sheets only) imports `@elirobinson/tokens/tokens.css` itself.
- Token overrides go in an unlayered `:root` block. `tokens.css` is unlayered, so an override inside `@layer base` silently loses to it. With `next/font`, re-point the families through `--ds-font-sans-override` / `--ds-font-mono-override` instead, with the font class on `<html>`.
- Patterns like heroes, page headers, empty states, and sidebars are compositions of primitives, not missing components.

## Step 3: Use tokens, not literals

In order of preference:

1. Token-backed utilities, if this repo maps them. With Tailwind v4, the `tailwind.css` import from Step 2 is what makes `bg-background`, `text-muted-foreground`, `border-border`, `text-accent`, `ring-ring` resolve to system tokens.
2. Typography classes: run `pnpm ds classes t-` for the current set.
3. Arbitrary values referencing a token: `text-[var(--fg-2)]`, `gap-[var(--space-6)]`, `shadow-[var(--shadow-md)]`, `duration-[var(--dur-fast)]`.

Leave out hex / `rgb()` / `oklch()` literals, magic px for radius, shadow, and motion, and ad-hoc font-size stacks where a `.t-*` class exists. `@elirobinson/eslint-config` fails the build on these.

Dark mode is `[data-theme="dark"]` (`.dark` also works). If this repo uses `next-themes` 0.4 or newer, set `attribute={["data-theme", "class"]}`.

## Step 4: Satisfy the contracts

`pnpm ds contracts` prints `@elirobinson/ai-patterns`' rules as data. Each one carries its own `check` plus a `verifiedBy` naming the lint rule or test helper that enforces it. Read them from the command, not from a summary in a doc, because the package is the authority.

The statically checkable ones are enforced by `@elirobinson/eslint-config`. The ones only a browser can settle (touch targets, visible focus, WCAG AA contrast) are enforced by the Playwright helpers in `@elirobinson/ai-patterns/testing/playwright`.

## Step 5: Write functional copy as chrome

Errors, empty states, helper and hint text, toasts, labels, button text, tooltips, confirmations and validation are chrome. State the fact, then the consequence, then the action, and stop. Leave out:

- Unverifiable frequency claims ("almost always", "this rarely happens"), because you do not have that data.
- Blame attribution ("on their side", "check your connection"). Say what is observable, not whose fault it might be.
- Filler pacing ("in a moment", "hang tight").
- Unprompted reassurance or apology ("don't worry", "we'll sort it out"). Reassurance is fine when it answers a question the reader is actually asking, and then it is a fact: "You have not been charged."
- Escalation paths nobody asked for ("if it keeps happening, reply to..."). They belong in a support surface, not a control.
- Enthusiasm ("Great news!", exclamation marks).

```
❌ You have not been charged. This is almost always a passing blip on their side,
   so try again in a moment. If it keeps happening, reply and we'll sort it out.
✅ You have not been charged. Try again.
```

Past two short sentences, functional copy is explaining, reassuring, or selling. Cut it back.

This rule covers chrome, not this product's editorial voice. Marketing prose, conversational surfaces, and written deliverables are content, and their voice is a deliberate design decision. Where a surface mixes the two, the chrome follows this rule and the content is left alone. Applying it to the content would flatten the product's voice, which does more harm than the padding it removes.

`@elirobinson/eslint-config` reports the literal phrases above. Its scope is that same line: copy props (`title`, `description`, `label`, `placeholder`, …) and the children of chrome components (`Alert`, `Toast`, `EmptyState`, …), not ordinary prose. It ships as a warning so an upgrade cannot break a build. Raise it with `designSystem({ copy: { severity: 'error' } })` once existing copy is clean.

## Step 6: When something is missing

Use the first rung that works:

1. Compose it from existing primitives.
2. Pull in a sanctioned gap-filler (in a shadcn/ui repo: `pnpm dlx shadcn@latest add <component>`, then restyle with tokens).
3. Hand-roll from tokens as a last resort, and say so in your summary as a design system gap worth upstreaming.

Foreign UI libraries (MUI, Chakra, Ant Design, Mantine, HeroUI, Headless UI, DaisyUI), direct Radix imports, and bare `@elirobinson/*` imports are blocked by ESLint. Pick a rung above instead of working around the ban.

Contributing a component upstream instead? `pnpm ds prompts add-component` prints a fill-in-the-blanks template for exactly that.

## Before you call UI work done

Run `pnpm ds patterns` and follow the Definition of Done for UI work checklist it prints. It lives in the package so it stays current; this file does not repeat it.
