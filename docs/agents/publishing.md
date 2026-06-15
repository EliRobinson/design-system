# Publishing

- Publish `@elirobinson/tokens`, `@elirobinson/react`, and `@elirobinson/ai-patterns` to GitHub Packages via Changesets on merge of the release PR.
- Squash-merge the **Version Packages** PR so the `push` to `main` triggers publish. If a bot merge does not trigger `push`, run **Release Metadata** manually (`workflow_dispatch`).
- Consumer apps need a `.npmrc` scoped to `@elirobinson` and a `NODE_AUTH_TOKEN` with `read:packages`.
