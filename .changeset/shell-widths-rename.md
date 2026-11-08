---
'@elirobinson/tokens': major
---

Breaking: the page widths `--container-sm` … `--container-2xl` are now `--shell-sm` … `--shell-2xl` (#250). The values are the same. The old names were Tailwind v4's own, and `tokens.css` declares them outside any layer, so with the design system installed Tailwind's `max-w-md` was 768px, not 448px, with no warning. Tailwind's `max-w-sm` … `max-w-2xl` now have Tailwind's sizes again.

- CSS and TSX: `var(--container-md)` becomes `var(--shell-md)`, and `max-w-(--container-md)` becomes `max-w-(--shell-md)`. `ds-resync migrate --write` rewrites these from `@elirobinson/tokens/migrations`.
- `@elirobinson/tokens/tokens.json`: the keys `containerSm` … `container2xl` are now `shellSm` … `shell2xl`.
- A Tailwind width utility that meant the design system's width (`max-w-md` for 768px) now gets Tailwind's size. Write `max-w-(--shell-md)` instead.
