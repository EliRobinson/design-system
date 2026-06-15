# Design System Monorepo

Nx-based monorepo for reusable design system libraries and project scaffolding.

## Packages

- `@elirobinson/tokens` — CSS and JSON design tokens.
- `@elirobinson/react` — Accessible React components bound to Miltinson tokens.
- `@elirobinson/ai-patterns` — AI UX patterns, prompt contracts, and guardrails.
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

## `@elirobinson/react` component inventory

Import components and styles in your app shell:

```tsx
import '@elirobinson/tokens/tokens.css';
import '@elirobinson/react/styles.css';
import { Button, Card, CardHeader, CardTitle, Input } from '@elirobinson/react';
```

### Actions & feedback

| Component                      | Import                         | Notes                                       |
| ------------------------------ | ------------------------------ | ------------------------------------------- |
| `Button`                       | `Button`                       | primary, accent, secondary, ghost; sm/md/lg |
| `Badge`                        | `Badge`                        | default, signal, anchor, solid, outline     |
| `Alert`                        | `Alert`                        | success, warning, danger, info              |
| `Toast`, `Toaster`, `useToast` | `Toast`, `Toaster`, `useToast` | aria-live notifications                     |
| `Progress`                     | `Progress`                     | determinate progress bar                    |
| `Skeleton`                     | `Skeleton`                     | loading placeholder                         |

### Forms

| Component  | Import     | Notes                      |
| ---------- | ---------- | -------------------------- |
| `Input`    | `Input`    | label, hint, error states  |
| `Textarea` | `Textarea` | multiline field            |
| `Select`   | `Select`   | native select with label   |
| `Label`    | `Label`    | standalone label           |
| `Checkbox` | `Checkbox` | labeled checkbox, 44px row |
| `Switch`   | `Switch`   | role=switch toggle         |

### Layout & navigation

| Component                    | Import                                           | Notes                          |
| ---------------------------- | ------------------------------------------------ | ------------------------------ |
| `Card` + subcomponents       | `Card`, `CardHeader`, `CardTitle`, …             | portfolio-style cards          |
| `Separator`                  | `Separator`                                      | horizontal / vertical hairline |
| `Tabs` + subcomponents       | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | ink underline active state     |
| `Breadcrumb` + subcomponents | `Breadcrumb`, `BreadcrumbList`, …                | page hierarchy                 |
| `Avatar` + subcomponents     | `Avatar`, `AvatarImage`, `AvatarFallback`        | sm/md/lg                       |

### Overlays

| Component                      | Import                                        | Notes                      |
| ------------------------------ | --------------------------------------------- | -------------------------- |
| `Dialog` + subcomponents       | `Dialog`, `DialogTrigger`, `DialogContent`, … | native `<dialog>` modal    |
| `Sheet` + subcomponents        | `Sheet`, `SheetTrigger`, `SheetContent`, …    | edge drawer via `<dialog>` |
| `DropdownMenu` + subcomponents | `DropdownMenu`, `DropdownMenuTrigger`, …      | keyboard-navigable menu    |
| `Popover` + subcomponents      | `Popover`, `PopoverTrigger`, `PopoverContent` | anchored floating panel    |
| `Tooltip` + subcomponents      | `Tooltip`, `TooltipTrigger`, `TooltipContent` | hover/focus tooltip        |

### Marketing typography

| Component  | Import     | Notes                      |
| ---------- | ---------- | -------------------------- |
| `Eyebrow`  | `Eyebrow`  | mono uppercase label       |
| `RuleLink` | `RuleLink` | ink underline + arrow link |

**Layout patterns** (Header, Footer, Hero, Sidebar, TopBar) are documented in Storybook under **Patterns/Marketing** and prototyped in `design-system-docs/ui_kits/` — compose them from primitives above rather than importing fixed layout components.

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

Latest published: `@elirobinson/react@0.2.0` (17 core components); overlay batch pending next release PR.

## Distribution

Library packages (`@elirobinson/tokens`, `@elirobinson/react`, `@elirobinson/ai-patterns`) are published to the [GitHub Packages npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

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
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Create a GitHub personal access token with `read:packages`, then install:

```bash
export NODE_AUTH_TOKEN=<your-github-pat>
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
