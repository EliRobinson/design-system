# Publishing

- Publish `@elirobinson/tokens`, `@elirobinson/react`, and `@elirobinson/ai-patterns` to GitHub Packages via Changesets on merge of the release PR.
- Scaffold new consumer apps with `npx github:EliRobinson/design-system/packages/create-elirobinson-design-system`.
- Consumer apps need a `.npmrc` scoped to `@elirobinson` and a `NODE_AUTH_TOKEN` with `read:packages`.
