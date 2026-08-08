# Publishing

- Publish `@elirobinson/tokens`, `@elirobinson/react`, and `@elirobinson/ai-patterns` to GitHub Packages via Changesets. Fully automatic — no manual release step.
- **Every PR that touches a published package must include a changeset** (`pnpm changeset`). The `Quality` workflow enforces this with `changeset status --since=origin/<base>` and fails the PR if one is missing.
- On merge to `main`, `Quality` runs first. If it passes, `Release` (`.github/workflows/release.yml`) runs `changeset version`, commits the bump straight to `main` as `chore(release): version packages`, then publishes and pushes the resulting git tags — all in one job, one run, no PR to merge. If `Quality` fails, `Release` never runs, so a broken `main` can't publish.
- `workflow_dispatch` still exists as a manual override, but nothing depends on it.
- Consumer apps need a `.npmrc` scoping `@elirobinson` to the registry, plus a PAT with `read:packages`. The token must live in the **user-level** npmrc (`pnpm config set "//npm.pkg.github.com/:_authToken" <pat>`) — pnpm 10 ignores registry credentials in a project `.npmrc`, so the `${NODE_AUTH_TOKEN}` form silently fails with a 401. In CI, `actions/setup-node` with `registry-url` generates a user-level npmrc from `NODE_AUTH_TOKEN`, which is why the release workflow authenticates correctly.
