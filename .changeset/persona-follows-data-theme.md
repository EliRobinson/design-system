---
'@elirobinson/ai-elements': patch
'@elirobinson/ai-patterns': patch
'@elirobinson/tokens': patch
---

`Persona` now follows the app's theme. It is dark when `<html>` has `data-theme="dark"` or the `dark` class, and light otherwise, the same rule the design system's CSS applies at `<html>`. It no longer reads the OS theme, so it no longer draws white on a light page when the OS is dark. It also watches `data-theme`, so a theme switch updates it without a reload. The `next-themes` advice in `patterns.md` and in the files written by `init --agents` is now `attribute={["data-theme", "class"]}` (`next-themes` 0.4 or newer), which sets both `data-theme` and the `.dark` class on `<html>` for third-party components that read only `.dark`. Re-run `init --agents --force` to refresh files written by an earlier version. The dark mode comment in `tokens.css` gives the same advice.
