# Run notes — docs site build (2026-08-07)

Scratch log: one entry per decision/correction a future session would otherwise
rediscover. Not a deliverable.

- **Worktree already contained the spec + prompt** (`docs/superpowers/specs/2026-08-07-docs-site-design.md`,
  `docs/prompts/fable-docs-site.md`), untracked. They match the run brief; treated the
  spec's decision table as settled.
- **Workspace linking confirmed**: `packages/react` → `@elirobinson/tokens` resolves as
  `link:../tokens` in pnpm-lock despite a plain `0.2.0` specifier, so `workspace:*` deps
  from apps/docs will link fine and no GH Packages auth is needed for install.
- **Root `.npmrc` warning is benign**: `${NODE_AUTH_TOKEN}` unexpanded → pnpm warns; only
  affects publishing to GH Packages, not local install.
- **Docs consume dist, not source** (unlike Storybook): workspace dep + Nx
  `dependsOn ^build` means the site exercises the real `exports` map — the same
  resolution a consumer gets. Chosen deliberately over source aliasing.
- **Committed generated manifest** (`apps/docs/src/generated/component-manifest.json`):
  regenerated before every build/dev, committed so lint/typecheck/format work without a
  build step. Drift window is zero in artifacts; repo copy refreshed by build.
- **Turbopack MDX constraint**: Next 16 builds with Turbopack; MDX plugin options must be
  serializable, so no function-valued rehype/remark plugins. Syntax highlighting is done
  in the `pre` MDX component mapping (shiki, server-side) instead of a rehype plugin.
