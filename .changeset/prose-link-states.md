---
'@elirobinson/react': patch
---

NavigationMenu, Breadcrumb and RuleLink links keep their own visited, focus and active styles inside a host `.prose`. A host `.prose a:visited`, `a:focus` or `a:active` rule no longer recolours, underlines, borders or fills a link, and a host `.prose a:focus-visible` rule no longer replaces the focus ring. These state rules and the focus rings now sit under the component root at (0,3,0) or higher. The active NavigationMenu link is now (0,3,0): an override of it, or of a link's focus ring, must be scoped under the root at that height to win.
