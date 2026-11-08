# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: Eli Robinson and the coding agents that build Miltinson products.** Eli runs
  many small products alone. Most UI is written by AI agents (Claude Code, Cursor,
  Copilot) working in each product's repo. They need to find the right component, token or
  rule fast, and get it right the first time.
- **Second: the end users of those products.** Parents and kids, learners, sports coaches,
  small-business clients, and users of Eli's own apps. The products are named under
  Evidence on Hand. End users never see the design system. They see whether each product
  is clear, fast and accessible.
- No outside teams. The package registry is private and stays private.

## Product Purpose

The Miltinson Design System keeps many small products consistent and fast to ship. A
product installs the packages, picks a palette, and builds from shared tokens and
accessible React components. Success: a new product is accessible, consistent and in its
chosen palette within minutes, and an upgrade is one version bump.

## Positioning

- **Agents ask the installed package; they do not read docs.** The `elirobinson-ds` CLI
  (aliased `ds`), the component manifest, the ESLint config and the agent files ship
  inside the packages, so what an agent reads always matches the version installed.
- **Nothing a consumer has to keep in sync by hand.** A component list, token table,
  Tailwind mapping or rule ships as a command, manifest, stylesheet or lint rule, never as
  prose to copy.
- **One system, many brands.** Every palette except the default is inert until a product
  chooses it. The system holds only what is true under every brand.

## Operating Context

- A monorepo of published `@elirobinson/*` packages (the list is in `AGENTS.md`). One of
  them, `@elirobinson/ai-elements`, is vendored from `vercel/ai-elements` and never
  hand-edited.
- Surfaces inside the repo: the docs site (`apps/docs`), Storybook (`apps/storybook`), the
  brand source in `design-system-docs/` (preview cards, UI kits, guidelines, voice), and
  visual regression baselines.
- Outside the repo: a Design System artifact on claude.ai that Claude Design builds from
  (see `docs/agents/design-system-artifact.md`).
- Consumers upgrade and adopt with the tools in `docs/agents/consumer-tooling.md`.

## Capabilities and Constraints

- Web only, including mobile web (`data-platform="mobile"`). No native iOS or Android.
- A React component library. Build rules for components are in `AGENTS.md` and
  `docs/agents/components.md`.
- Light and dark themes. A product picks a palette through `data-palette`; a default sits
  on `:root`. Fonts can be overridden per product. `pnpm ds dials` lists the palettes and
  themes; never copy the names.
- Tailwind v4 works through `@elirobinson/tokens/tailwind.css`.
- Breaking changes need a major version and an entry `ds-resync` can act on.

## Brand Commitments

- Owner brand: **Miltinson Technologies**, the studio of Eli Robinson.
- Voice: the `miltinson` voice pack (`design-system-docs/miltinson.voice.json`) is the
  default. It is a named, replaceable pack, not a rule for every product. Read it there; do
  not copy it.
- The brand boundary (`docs/agents/brand-boundary.md`) decides what is the system's and
  what is a product's. A constraint stays in the system only if it holds without naming a
  brand's character.

## Evidence on Hand

- Brand source: `design-system-docs/` (preview cards, UI kits, guidelines, voice, slides).
- Component gallery artifact (components and in-use screens):
  https://claude.ai/artifact/5q96yynovFvZpUe9miqm2R
- Design System artifact: see `docs/agents/design-system-artifact.md`.
- Consumer products, confirmed by Eli on 2026-11-08 (a dated snapshot, not a roster):
  miltinsons.com, Kids Recipes, Interactive Maths, Coaching Guides, health-app,
  fantasy-gbbo.
- About 45 GitHub issues in this repo record real gaps that consumer apps hit. They are
  the best evidence of how the system is used.
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
- Touch targets follow the two-tier rule in `docs/agents/components.md` (Constraints): a
  larger floor for primary controls, a smaller one for dense inline controls, and an
  expanded hit area never overlaps sibling content.
- Visible focus rings, forced-colors support, and `prefers-reduced-motion` respected.
- End users include children and learners. Plain words and clear states matter.
