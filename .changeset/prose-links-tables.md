---
'@elirobinson/react': patch
---

NavigationMenu, Breadcrumb and RuleLink links, and Table's table, keep their own styles inside a host `.prose`. A host link rule no longer underlines, recolours, re-borders or re-pads them, and a host table rule no longer adds margins, cell borders, row stripes or cell alignment. The links' type, spacing, borders and decoration, their active and current states, and Table's table, row and cell rules now sit under the component root at (0,2,0). A single-class override on them, including a `className` utility, must now be scoped under the root to win. The current Breadcrumb crumb no longer takes the link hover colour.
