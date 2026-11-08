---
'@elirobinson/tokens': minor
---

Add `--focus-ring-width` (2px), `--focus-ring-offset` (2px) and `--radius-full` (9999px). `--shadow-focus` and the global `:focus-visible` ring are now built from the two focus tokens; both render as before. Set `--focus-ring-width` or `--focus-ring-offset` once to change every focus ring. `--radius-full` is for shapes that are always fully round; `--radius-pill` stays for tags. No token is removed or renamed. `tokens.json` gains `radius.full`, `layout.focusRingWidth` and `layout.focusRingOffset`.
