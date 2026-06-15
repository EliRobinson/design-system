# Tokens

## Token-first rule

- Import `@elirobinson/tokens/tokens.css` in every app shell.
- Never hardcode spacing, radii, colors, or durations — use CSS custom properties from tokens.
- Reference semantic tokens (`--fg`, `--surface`, `--accent`, etc.) in components, not raw scale values (`--ink-500`).
