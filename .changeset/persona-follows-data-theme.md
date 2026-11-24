---
'@elirobinson/ai-elements': patch
'@elirobinson/ai-patterns': patch
---

`Persona` now follows the app's theme. It is dark when `<html>` has `data-theme="dark"` or the `dark` class, and light otherwise, the same rule as the design system's CSS. It no longer reads the OS theme, so it no longer draws white on a light page when the OS is dark. It also watches `data-theme`, so a theme switch updates it without a reload. The `next-themes` advice in `patterns.md` and in the files written by `init --agents` is now `attribute={["data-theme", "class"]}`, which sets both `data-theme` and the `.dark` class on `<html>` for third-party components that read only `.dark`. Re-run `init --agents --force` to refresh files written by an earlier version.
