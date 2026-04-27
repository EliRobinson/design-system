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

Semantic-release runs in CI on `main` after Changesets publish and will:

- create/update `CHANGELOG.md`,
- create git tags in the form `vX.Y.Z`,
- and publish GitHub release notes from conventional commits.

## Publish packages to GitHub Packages

1. Create a GitHub Personal Access Token with `write:packages` and `read:packages`.
2. Add `NPM_TOKEN` to GitHub repo secrets.
3. Push to `main` to let the Changesets workflow open/update release PRs.
4. Merge the release PR to publish packages to GitHub Packages.

## Generate a new project

```bash
npx create-elirobinson-design-system my-app
```

The generator now scaffolds a Next.js App Router project wired to:

- `@elirobinson/tokens` for token imports,
- `@elirobinson/react` for component primitives,
- and `pnpm` scripts for dev/build/start.

## GitHub Project Automation

New issues and pull requests are auto-added to your GitHub Project using:

- `./.github/workflows/project-automation.yml`

Required repository configuration:

- Set repository variable `GITHUB_PROJECT_URL` to your Project URL.
- Set repository secret `ADD_TO_PROJECT_PAT` to a PAT with project write access.
