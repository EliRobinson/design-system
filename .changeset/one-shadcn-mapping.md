---
'@elirobinson/ai-patterns': patch
---

`migrate/adopt/shadcn.md` is now the one shadcn → Miltinson component mapping. It gains the rows only the old contributor table had (`Chip`, `Combobox`, `NavigationMenu`, `SegmentedControl`, `Kbd`, `FormField`, `VirtualTable`), and the `Separator` row now names each component it maps. A new test fails if a second shadcn mapping table appears anywhere in the repo.
