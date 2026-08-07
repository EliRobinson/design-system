# Publishing

- Publish `@elirobinson/tokens`, `@elirobinson/react`, and `@elirobinson/ai-patterns` to GitHub Packages via Changesets. Fully automatic — no manual release step.
- **Every PR that touches a published package must include a changeset** (`pnpm changeset`). The `Quality` workflow enforces this with `changeset status --since=origin/<base>` and fails the PR if one is missing.
- On merge to `main`, `Quality` runs first. If it passes, `Release` (`.github/workflows/release.yml`) runs `changeset version`, commits the bump straight to `main` as `chore(release): version packages`, then publishes and pushes the resulting git tags — all in one job, one run, no PR to merge. If `Quality` fails, `Release` never runs, so a broken `main` can't publish.
- `workflow_dispatch` still exists as a manual override, but nothing depends on it.
- Consumer apps need a `.npmrc` scoped to `@elirobinson` and a `NODE_AUTH_TOKEN` with `read:packages`.
