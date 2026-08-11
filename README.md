# Design System Monorepo

Nx-based monorepo for reusable design system libraries and project scaffolding.

## Packages

- `@elirobinson/tokens` — CSS and JSON design tokens.
- `@elirobinson/react` — Accessible React components bound to Miltinson tokens.
- `@elirobinson/ai-patterns` — AI UX patterns, prompt contracts, guardrails, and the `ds` discovery CLI.
- `@elirobinson/eslint-config` — the statically checkable contracts as a flat ESLint config.
- `create-elirobinson-design-system` — `npx` starter generator.

## Quick start

```bash
pnpm install
pnpm build
```

## Storybook

```bash
npx nx run storybook:storybook
```

## What's in `@elirobinson/react` — ask, don't read

Import components and styles in your app shell:

```tsx
import '@elirobinson/tokens/tokens.css';
import '@elirobinson/react/styles.css';
import { Button } from '@elirobinson/react/components/atoms/Button';
import { Card, CardHeader, CardTitle } from '@elirobinson/react/components/molecules/Card';
```

There is no inventory table here on purpose. This README used to carry one; by the time
`@elirobinson/react` reached 1.1.0 it listed 25 of 45 components under a heading claiming
0.2.0 had 17. Every such list rots on the next release, and a consumer who copied it has no
way to know.

Ask the installed package instead — `@elirobinson/ai-patterns` ships the `elirobinson-ds`
bin for exactly this:

```bash
pnpm add -D @elirobinson/ai-patterns@latest   # then: "scripts": { "ds": "elirobinson-ds" }

pnpm ds                  # components with exports and variants, hooks, typography, token groups
pnpm ds props Card       # props, variant unions, and the exact import line to copy
pnpm ds tokens accent    # tokens and their values
pnpm ds contracts        # the rules your UI must satisfy, and what verifies each
pnpm ds patterns         # working principles and the definition of done for UI work
pnpm ds init --agents    # install the Claude Code / Cursor / Copilot / AGENTS.md instructions
```

It reads `node_modules` at run time and walks the package tree rather than assuming a
layout, so it stays correct across releases — including the 0.x flat layout and the 1.x
`atoms`/`molecules`/`organisms` one. Machine-readable equivalent:
`@elirobinson/react/manifest`.

**Layout patterns** (Header, Footer, Hero, Sidebar, TopBar) are documented in Storybook under **Patterns/Marketing** and prototyped in `design-system-docs/ui_kits/` — compose them from primitives rather than importing fixed layout components.

## Adopt the design system in an app

Starting a new project? `npx github:EliRobinson/design-system/packages/create-elirobinson-design-system my-app` scaffolds most of this for you — skip to step 6.

Adding the system to an existing app takes about ten minutes. Nothing below has to be revisited when this repo changes: bump a version and you are current.

### 1. Authenticate and install

Packages live in GitHub Packages, so the app needs a registry line and a token with `read:packages` — see [Install packages in a consumer app](#install-packages-in-a-consumer-app) for the auth details, including the pnpm 10 gotcha.

```bash
pnpm add @elirobinson/react@latest @elirobinson/tokens@latest
pnpm add -D @elirobinson/ai-patterns@latest @elirobinson/eslint-config@latest
```

`react` and `tokens` ship code the app renders; the other two are tooling.

### 2. Add the discovery command

```jsonc
// package.json
"scripts": { "ds": "elirobinson-ds" }
```

This is the single most useful line in the list. `pnpm ds` reads `node_modules` at run time, so it always describes the versions actually installed — which is why no doc here lists components.

Three ways to reach it, in order of how often you'll want them:

```bash
pnpm ds                                          # with the script above
pnpm exec elirobinson-ds                         # installed, no script
pnpm dlx @elirobinson/ai-patterns elirobinson-ds # not installed at all
```

All three describe the _project you run them in_ — even the `dlx` form, which reads the local `@elirobinson/react` and `@elirobinson/tokens` and falls back to its own copy for contracts, patterns and prompts. Handy for inspecting a repo you haven't set up yet.

### 3. Import the stylesheets once, in the app shell

```tsx
// app/layout.tsx — order matters
import '@elirobinson/tokens/tokens.css';
import '@elirobinson/react/styles.css';
```

Never re-import per component.

### 4. Wire up Tailwind (v4 only)

```css
/* app/globals.css */
@import 'tailwindcss';
@import '@elirobinson/tokens/tailwind.css';
```

This is what makes `bg-background`, `text-muted-foreground`, `border-border`, `rounded-md` and friends resolve to design system tokens. Without it they resolve to Tailwind's defaults, or to nothing at all. Don't hand-roll the mapping — the shadcn/ui variable contract collides with these token names, and the obvious `--accent: var(--accent)` alias is circular.

Not using Tailwind? Skip this. `var(--token)` and the `.t-*` typography classes work anywhere.

### 5. Turn the contracts into build failures

```js
// eslint.config.mjs
import designSystem from '@elirobinson/eslint-config';

export default [
  // …your existing config
  ...designSystem(),
];
```

Catches bare `@elirobinson/*` imports (which never resolve), foreign component libraries, direct Radix imports, and hardcoded colours, radii, shadows and durations. Add `@elirobinson/eslint-config/css` for the same checks in stylesheets.

### 6. Install the agent instructions

```bash
pnpm ds init --agents
```

Writes a Claude Code skill, a Cursor rule, Copilot instructions, and an `AGENTS.md` block — so whichever tool a teammate drives reaches for the system first. None of them contains an inventory; they all point at `ds`. Re-running is safe: existing files are left alone unless you pass `--force`, and the `AGENTS.md` block updates in place between its markers.

### 7. Check the contracts a browser has to settle

```ts
// e2e/design-system.spec.ts
import { test } from '@playwright/test';
import { expectDesignSystemContracts } from '@elirobinson/ai-patterns/testing/playwright';

test('home page meets the design system contracts', async ({ page }) => {
  await page.goto('/');
  await expectDesignSystemContracts(page);
});
```

Covers 44×44 touch targets, visible focus, non-overlapping hit areas, and WCAG AA contrast. Needs `axe-core` alongside your Playwright install.

### 8. If you have a theme switcher, point it at `data-theme`

```tsx
<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
```

`next-themes` defaults to a `class` strategy. A `.dark` compatibility selector ships too, so either works — but `data-theme` is what every component's CSS is written against.

### Staying current

```bash
pnpm exec ds-resync           # what's out of date, and what changed while you were away
pnpm exec ds-resync --write   # apply it
```

If the package isn't installed — a repo scaffolded before any of this existed, or a one-off check — run it straight from the registry instead:

```bash
pnpm dlx @elirobinson/ai-patterns ds-resync
pnpm dlx @elirobinson/ai-patterns ds-resync --write
```

`ds-resync` ships in the same package and answers the other question: `ds` describes the version you have, `ds-resync` tells you whether you should have a newer one.

### What each package gives you

See [docs/agents/consumer-tooling.md](docs/agents/consumer-tooling.md) for the reasoning behind each piece.

| Package                      | What it gives a consumer                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@elirobinson/react`         | Components, hooks, and `./manifest` — the machine-readable inventory                                        |
| `@elirobinson/tokens`        | `tokens.css`, plus `tailwind.css` mapping Tailwind v4's theme namespaces onto the tokens                    |
| `@elirobinson/ai-patterns`   | `ds` and `ds-resync`, contracts, prompt templates, agent instruction templates, Playwright contract helpers |
| `@elirobinson/eslint-config` | The statically checkable contracts as a flat config, including `no-hardcoded-design-values`                 |

### Migrating an existing UI

`pnpm ds prompts adopt-system` prints a fill-in-the-blanks brief for handing the migration to an agent: it covers this setup, the order to work in, and a verification checklist.

## Releases

```bash
pnpm changeset
pnpm changeset:version
```

Changesets versions packages and publishes them to GitHub Packages on merge of the release PR.

Semantic-release runs in CI on `main` and will:

- create/update `CHANGELOG.md`,
- create git tags in the form `vX.Y.Z`,
- and publish GitHub release notes from conventional commits.

Run `pnpm ds --version` in a consuming app for the versions it actually has installed; a version number written down here is stale the moment the next release PR merges.

## Distribution

Library packages (`@elirobinson/tokens`, `@elirobinson/react`, `@elirobinson/ai-patterns`, `@elirobinson/eslint-config`) are published to the [GitHub Packages npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

1. Push to `main` with a changeset to open/update the release PR.
2. Merge the release PR to bump versions, publish packages, and generate GitHub releases.

The starter generator is still installed directly from GitHub:

```bash
npx github:EliRobinson/design-system/packages/create-elirobinson-design-system my-app
```

### Install packages in a consumer app

Add `.npmrc` to the app (the generator scaffolds this):

```
@elirobinson:registry=https://npm.pkg.github.com
```

Create a GitHub personal access token with `read:packages`. The token goes in your
user-level npmrc rather than the project one — pnpm 10 ignores registry credentials
found in a project `.npmrc`, so the older `${NODE_AUTH_TOKEN}` form fails with a 401:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" <your-github-pat>
pnpm add @elirobinson/tokens @elirobinson/react
```

## Generate a new project

```bash
npx github:EliRobinson/design-system/packages/create-elirobinson-design-system my-app
```

The generator scaffolds a Next.js App Router project wired to:

- `@elirobinson/tokens` for token imports,
- `@elirobinson/react` for component primitives,
- a project `.npmrc` for GitHub Packages auth,
- and `pnpm` scripts for dev/build/start.
