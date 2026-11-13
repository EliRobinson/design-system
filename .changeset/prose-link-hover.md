---
'@elirobinson/react': patch
---

NavigationMenu, Breadcrumb and RuleLink links keep their own hover styles inside a host `.prose`. A host `.prose a:hover` rule no longer recolours or underlines a hovered link. The three hover rules now sit under the component root at (0,3,0) or higher, so a single-class override of a link's hover, including a `className` utility, must now be scoped under the root to win.
