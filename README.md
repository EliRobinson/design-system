# Miltinson Design System Monorepo

Nx-based monorepo for reusable design system libraries and project scaffolding.

## Packages
- `@miltinson/tokens`: CSS and JSON design tokens.
- `@miltinson/react`: Accessible React components bound to tokens.
- `@miltinson/ai-patterns`: AI UX patterns, prompt contracts, and guardrails.
- `create-miltinson-design-system`: `npx` starter generator.

## Quick start
```bash
npm install
npm run build
```

## Publish packages to GitHub Packages
1. Create a GitHub Personal Access Token with `write:packages` and `read:packages`.
2. Add `NPM_TOKEN` to GitHub repo secrets.
3. Set package names to your org scope (e.g. `@your-org/tokens`) if needed.
4. Trigger the publish workflow from GitHub Actions.

## Generate a new project
```bash
npx create-miltinson-design-system my-app
```
