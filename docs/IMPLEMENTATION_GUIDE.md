# Implementation Guide

## Token-first rule
- Use `@miltinson/tokens/tokens.css` in every app shell.
- Never hardcode spacing, radii, colors, or durations.

## Component adoption order
1. Replace primitive `button`, `input`, and card wrappers with `@miltinson/react`.
2. Move style values to CSS custom properties from tokens.
3. Keep all interactions keyboard accessible and focus-visible compliant.

## AI pattern alignment
- Keep prompts and AI UX contracts in `@miltinson/ai-patterns`.
- Enforce practical tone and avoid hype language in generated copy.

## Publishing strategy
- Publish packages to GitHub Packages from this monorepo.
- Consume packages in other repos via npm scope and `.npmrc` auth.
