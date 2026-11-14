---
'@elirobinson/react': patch
---

NavigationMenu, Breadcrumb and RuleLink links keep their own visited, focus and active styles inside a host `.prose`. A host `.prose a:visited`, `a:focus` or `a:active` rule no longer recolours, underlines, borders or fills a link, and a host `.prose a:focus-visible` rule no longer replaces the focus ring. These state rules and the focus rings now sit at (0,3,0) or higher, scoped under the component's own class. A visited link on a `[data-on-fill]` surface still takes `--link-on-fill`. The active NavigationMenu link is now (0,3,0). An override of a link's colour that should reach a visited, focused or pressed link, of the active link, or of a focus ring, must be scoped under the root at (0,3,0) to win.
