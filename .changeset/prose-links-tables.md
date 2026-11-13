---
'@elirobinson/react': patch
---

NavigationMenu, Breadcrumb and RuleLink links, and Table's table, keep their own styles inside a host `.prose`. A host link rule no longer underlines or recolours them, and a host table rule no longer adds margins, row rules or cell alignment. The active NavigationMenu link and the current Breadcrumb crumb are now set at (0,2,0); override them at (0,2,0) too.
