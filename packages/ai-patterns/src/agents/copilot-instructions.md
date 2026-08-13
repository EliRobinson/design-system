# Copilot instructions

## UI: design system first

All UI is built from **`@elirobinson/react`** (components, hooks), **`@elirobinson/tokens`** (color, type, space, radius, shadow, motion), and **`@elirobinson/ai-patterns`** (UI contracts, working patterns, prompt templates). These are the primary source of components, tokens, and design patterns — see the upstream [design system](https://github.com/EliRobinson/design-system).

- Discover what exists with `pnpm ds` (also `pnpm ds props <Name>`, `pnpm ds tokens [filter]`, `pnpm ds classes`, `pnpm ds contracts`, `pnpm ds patterns`, `pnpm ds prompts`). It reads `node_modules` at run time, so it matches what is installed — do not trust a component list from memory or from a doc. If it warns on stderr that `node_modules` disagrees with the lockfile, install first: what is installed is not what CI builds. `pnpm exec elirobinson-ds` works if the `ds` script is not wired up.
- Import per component with the full subpath; `pnpm ds props <Name>` prints the exact import line. There is no barrel export and a bare `@elirobinson/react` import does not resolve.
- Satisfy the contracts from `pnpm ds contracts`. Each carries its own `check` and a `verifiedBy` naming the lint rule or Playwright helper that enforces it.
- Style with the component's own `variant` / `size` props; use utility classes for layout only.
- Colors, radii, shadows, durations, and font sizes come from tokens: mapped utilities (`bg-background`, `text-muted-foreground`, `border-border`, `text-accent`), `.t-*` typography classes, or `var(--token)` in arbitrary values. Never hardcode a literal — `@elirobinson/eslint-config` fails the build on these.
- With Tailwind v4, `@import '@elirobinson/tokens/tailwind.css'` is what makes the token-backed utilities resolve.
- Dark mode is `[data-theme="dark"]` (`.dark` also works). With `next-themes`, set `attribute="data-theme"` — the default `class` strategy silently does nothing.
- Token overrides go in an **unlayered** `:root` block — `tokens.css` is unlayered, so an override inside `@layer base` silently loses to it. With `next/font`, re-point the families through `--ds-font-sans-override` / `--ds-font-mono-override` instead, with the font class on `<html>`.
- Missing a piece? Compose it from primitives → then the repo's sanctioned gap-filler → then hand-roll from tokens and flag it as a design system gap.
- Other component libraries (MUI, Chakra, Ant Design, Mantine, HeroUI, Headless UI, DaisyUI), direct Radix imports, and bare `@elirobinson/*` imports are blocked by ESLint.
- Before calling UI work done, run `pnpm ds patterns` and work the **Definition of Done for UI work** checklist it prints.
