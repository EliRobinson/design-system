<!-- design-system:begin -->
<!-- Managed by `elirobinson-ds init --agents`. Edit above or below this block,
     not inside it — re-running init replaces everything between the markers. -->

## UI: design system first

All UI in this repo is built from **`@elirobinson/react`** (components, hooks), **`@elirobinson/tokens`** (color, type, space, radius, shadow, motion), and **`@elirobinson/ai-patterns`** (UI contracts, working patterns, prompt templates). Upstream: https://github.com/EliRobinson/design-system

**Discover, don't document.** Never paste or trust a component inventory, token list, or prop signature — it is wrong as of the next release. Ask the installed packages:

```bash
pnpm ds                  # components (+ exports & variants), hooks, typography classes, token groups
pnpm ds props <Name>     # props, variant unions, and the exact import line to copy
pnpm ds tokens [filter]  # tokens and their values
pnpm ds classes [filter] # CSS classes the design system ships
pnpm ds contracts        # machine-checkable UI rules, each with its check and what verifies it
pnpm ds patterns         # working principles and the definition of done for UI work
pnpm ds prompts [name]   # reusable prompt templates
```

`pnpm exec elirobinson-ds` is the same command if the `ds` script is not wired up.

### Rules

- Import per component with the full subpath. There is no barrel export; a bare `@elirobinson/react` import does not resolve.
- Drive appearance with a component's own `variant` / `size` props. Utility classes are for layout; the design system owns look.
- Colors, radii, shadows, durations, and font sizes come from tokens — mapped utilities, `.t-*` classes, or `var(--token)`. Never a literal.
- With Tailwind v4, `@import '@elirobinson/tokens/tailwind.css'` maps the Tailwind color namespace onto the tokens; without it, utilities like `bg-background` resolve to nothing.
- Dark mode is `[data-theme="dark"]` (`.dark` also works). With `next-themes`, set `attribute="data-theme"`.
- Token overrides go in an **unlayered** `:root` block — `tokens.css` is unlayered, so an override inside `@layer base` silently loses to it. With `next/font`, re-point the families through `--ds-font-sans-override` / `--ds-font-mono-override` instead, with the font class on `<html>`.
- Stylesheets (`@elirobinson/tokens/tokens.css`, then `@elirobinson/react/styles.css`) are imported once in the app shell.
- Missing a piece? Compose from primitives → the repo's sanctioned gap-filler → hand-roll from tokens and flag it as a design system gap worth upstreaming.
- Foreign UI libraries, direct Radix imports, bare `@elirobinson/*` imports, and hardcoded design values are blocked by `@elirobinson/eslint-config`.
- Contract checks a browser has to settle — touch targets, visible focus, WCAG AA contrast — come from `@elirobinson/ai-patterns/testing/playwright`; drop them into the E2E suite.

Before calling UI work done, run `pnpm ds patterns` and work the **Definition of Done for UI work** checklist it prints.

<!-- design-system:end -->
