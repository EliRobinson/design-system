# AI patterns

- Keep prompts in `@elirobinson/ai-patterns/patterns` and UX contracts in `@elirobinson/ai-patterns/contracts` — no package root barrel.
- Enforce practical tone and avoid hype language in generated copy.
- Follow `packages/ai-patterns/src/contracts.json` for touch targets, focus-visible, and WCAG AA contrast.
- `ds-resync` (`packages/ai-patterns/src/resync/`) brings a consuming repo's `@elirobinson/*`
  deps up to date: `pnpm dlx @elirobinson/ai-patterns ds-resync` reports, `--write` applies.
  The agent-facing instructions ship at `@elirobinson/ai-patterns/resync/skill`.
