# Miltinson Design System Monorepo

Nx-based monorepo for reusable design system libraries and project scaffolding.

## Packages

- `@elirobinson/tokens`: CSS and JSON design tokens.
- `@elirobinson/react`: Accessible React components bound to tokens.
- `@elirobinson/ai-patterns`: AI UX patterns, prompt contracts, and guardrails.
- `create-elirobinson-design-system`: `npx` starter generator.

## Quick start

```bash
pnpm install
pnpm build
```

## Storybook

```bash
npx nx run storybook:storybook
```

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

## GitHub Project Automation

New issues and pull requests are auto-added to your GitHub Project using:

- `./.github/workflows/project-automation.yml`

Required repository configuration:

- Set repository variable `GITHUB_PROJECT_URL` to your Project URL.
- Set repository secret `ADD_TO_PROJECT_PAT` to a PAT with project write access.
