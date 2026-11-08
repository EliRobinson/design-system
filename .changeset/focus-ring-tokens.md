---
'@elirobinson/tokens': minor
---

Add `--focus-ring-width` (2px), `--focus-ring-offset` (2px) and `--radius-full` (9999px). `--shadow-focus` and the global `:focus-visible` ring are now built from the two focus tokens; both render as before. Set `--focus-ring-width` on `:root` to change the width of every focus ring, and `--focus-ring-offset` to change the gap of the standard ring. Dense controls keep a tight 1px gap. `--radius-full` is for shapes that are always fully round; `--radius-pill` stays for tags. No token is removed or renamed. `tokens.json` gains `radius.full`, `layout.focusRingWidth` and `layout.focusRingOffset`.
