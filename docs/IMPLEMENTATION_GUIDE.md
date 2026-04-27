# Implementation Guide

## Token-first rule

- Use `@elirobinson/tokens/tokens.css` in every app shell.
- Never hardcode spacing, radii, colors, or durations.

## Component adoption order

1. Replace primitive `button`, `input`, and card wrappers with `@elirobinson/react`.
2. Move style values to CSS custom properties from tokens.
3. Keep all interactions keyboard accessible and focus-visible compliant.

## AI pattern alignment

- Keep prompts and AI UX contracts in `@elirobinson/ai-patterns`.
- Enforce practical tone and avoid hype language in generated copy.

## Publishing strategy

- Distribute the starter directly from GitHub (no package registry publish).
- Run the generator via `npx github:elirobinson/create-elirobinson-design-system`.
