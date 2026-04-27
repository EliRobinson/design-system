# Miltinson Design System Monorepo

Nx-based monorepo for reusable design system libraries and project scaffolding.

## Packages
- `@elirobinson/tokens`: CSS and JSON design tokens.
- `@elirobinson/react`: Accessible React components bound to tokens.
- `@elirobinson/ai-patterns`: AI UX patterns, prompt contracts, and guardrails.
- `create-elirobinson-design-system`: `npx` starter generator.

## Quick start
```bash
npm install
npm run build
```

## Storybook
```bash
npx nx run storybook:storybook
```

## Releases
```bash
npm run changeset
npm run changeset:version
```

## Publish packages to GitHub Packages
1. Create a GitHub Personal Access Token with `write:packages` and `read:packages`.
2. Add `NPM_TOKEN` to GitHub repo secrets.
3. Push to `main` to let the Changesets workflow open/update release PRs.
4. Merge the release PR to publish packages to GitHub Packages.

## Generate a new project
```bash
npx create-elirobinson-design-system my-app
```
