---
'@elirobinson/ai-patterns': patch
---

`migrate/adopt/shadcn.md` is now the one shadcn → Miltinson component mapping. It gains the rows only the old contributor table had (`Chip`, `Combobox`, `NavigationMenu`, `SegmentedControl`, `Kbd`, `FormField`, `VirtualTable`), `Slider` gets its own row (a native range input with a number value, not Radix's array), and the shared row now names each component it maps. A repo test fails if a second shadcn mapping table appears anywhere else.
