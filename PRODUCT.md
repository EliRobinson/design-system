# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: Eli Robinson and the coding agents that build Miltinson products.** Eli runs
  many small products alone. Most UI is written by AI agents (Claude Code, Cursor,
  Copilot) working in each product's repo. They need to find the right component, token or
  rule fast, and get it right the first time.
- **Second: the end users of those products.** Parents and kids (Kids Recipes), learners
  (Interactive Maths), coaches (Coaching Guides), small-business clients
  (miltinsons.com), and users of Eli's own apps such as health-app and fantasy-gbbo.
  They never see the design system. They see whether each product is clear, fast and
  accessible.
- No outside teams. The package registry is private and stays private.

## Product Purpose

The Miltinson Design System keeps many small products consistent and fast to ship. A
product installs the packages, picks a palette, and builds from shared tokens and
accessible React components. Success: a new product looks and behaves like Miltinson in
minutes, and an upgrade is one version bump.

## Positioning

- **Agents ask the installed package; they do not read docs.** The `ds` CLI, the
  component manifest, the ESLint config and the agent files ship inside the packages, so
  what an agent reads always matches the version installed.
- **Nothing a consumer has to keep in sync by hand.** A component list, token table,
  Tailwind mapping or rule ships as a command, manifest, stylesheet or lint rule, never as
  prose to copy.
- **One system, many brands.** Palettes are inert until a product chooses one. The system
  holds only what is true under every brand.

## Operating Context

- Monorepo of published packages: `@elirobinson/tokens`, `@elirobinson/react`,
  `@elirobinson/ai-elements` (vendored from `vercel/ai-elements`, never hand-edited),
  `@elirobinson/ai-patterns`, `@elirobinson/eslint-config`,
  `@elirobinson/design-system-mcp`, and a `create-elirobinson-design-system` starter.
- Surfaces inside the repo: the docs site (`apps/docs`), Storybook (`apps/storybook`), the
  brand source in `design-system-docs/` (preview cards, UI kits, guidelines, voice), and
  visual regression baselines.
- Outside the repo: a "Miltinson Design System" artifact on claude.ai that Claude Design
  builds from, synced by hand with `build:design-system-artifact`.
- Consumers upgrade with `ds-resync`; new apps adopt with the `adopt-system` prompt.
- Work runs as GitHub issues, one worktree and branch each, with a review gate before
  every PR.

## Capabilities and Constraints

- Web only, including mobile web (`data-platform="mobile"`). No native iOS or Android.
- React components in four tiers: atoms, molecules, organisms, ai. Every interactive
  component uses `forwardRef`.
- Themes: light and dark. Palettes: `ember` (the default, on `:root`), and `miltinson`,
  `miltinson-tech`, `slate`, `steady` through `data-palette`. Fonts are Geist and JetBrains Mono, overridable through
  `--ds-font-sans-override` and `--ds-font-mono-override`.
- Tailwind v4 works through `@elirobinson/tokens/tailwind.css`.
- No barrel files. Consumers import by package subpath.
- Breaking changes need a major version and an entry `ds-resync` can act on.

## Brand Commitments

- Owner brand: **Miltinson Technologies**, the studio of Eli Robinson. Taglines:
  "Builder. Consultant. Founder." and "Practical tech, honestly built."
- Voice: the `miltinson` voice pack (`design-system-docs/miltinson.voice.json`). Practical,
  honest, warm. Reader is "you". It is a named, replaceable pack, not a system rule.
- The brand boundary (`docs/agents/brand-boundary.md`) decides what is the system's and
  what is a product's. A constraint stays in the system only if it holds without naming a
  brand's character.

## Evidence on Hand

- Brand source: `design-system-docs/` (preview cards, UI kits, guidelines, voice, slides).
- Component gallery artifact with every component and 6 in-use screens:
  https://claude.ai/artifact/5q96yynovFvZpUe9miqm2R
- Design System artifact: https://claude.ai/artifact/Xvkzcg7hpZRPBZ5ijZcTL1
- Real consumers: miltinsons.com, Kids Recipes, Interactive Maths, Coaching Guides,
  health-app, fantasy-gbbo.
- No testimonials, usage numbers or outside customers. Do not invent them.

## Product Principles

1. **Ask the package, never a copy.** Facts an agent needs ship with the version that
   needs them.
2. **A bump is enough.** A consumer upgrades by changing a version; tools migrate the rest.
3. **True under every brand.** The system ships what is inert until chosen or right for
   every product.
4. **Machine-checked over written.** A rule that can be a test or lint rule is one.
5. **Accessible by default.** A component is not done until it meets the accessibility
   floor below.

## Accessibility & Inclusion

- WCAG 2.2 AA across every component, palette and theme, checked in light and dark.
- Touch targets: at least 44x44 for primary controls; at least 24x24 for dense inline
  controls. An expanded hit area never overlaps sibling content.
- Visible focus rings, forced-colors support, and `prefers-reduced-motion` respected.
- Users include children (Kids Recipes) and learners (Interactive Maths). Plain words and
  clear states matter.
