# Changesets

Add a changeset when package-facing changes are made:

```bash
pnpm changeset
```

A breaking change also needs a section in `packages/ai-patterns/src/migrate/upgrade.md`.
See `docs/agents/ai-patterns.md` (Migration patterns).

Then version locally:

```bash
pnpm changeset:version
```
