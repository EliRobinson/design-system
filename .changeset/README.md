# Changesets

Add a changeset when package-facing changes are made:

```bash
pnpm changeset
```

A breaking change also needs a section in `packages/ai-patterns/src/migrate/upgrade.md`.
On 0.x, start a breaking `minor` changeset's text with `**Breaking:**`. See
`docs/agents/publishing.md`.

Then version locally:

```bash
pnpm changeset:version
```
