---
'@elirobinson/react': minor
---

Upgrade `@tanstack/react-table` from v8 to v9 (`^9.1.2`) and rewrite `Table` / `VirtualTable`
against the real v9 API — `useTable` plus a `tableFeatures()` feature set and
`create*RowModel()` factories, replacing v8's `useReactTable` and `get*RowModel()` options.

**Runtime dependency major.** `@tanstack/react-table` is a regular dependency of this package,
so bumping it upgrades transitively and needs no action from you — unless you import
`@tanstack/react-table` yourself. If your own code does
`import type { ColumnDef } from '@tanstack/react-table'` and passes those columns to our
`Table`, that type no longer matches: v9's `ColumnDef` takes the table's feature set as its
first generic. Import `ColumnDef` from `@elirobinson/react/components/organisms/Table`
instead, which is unchanged and still single-generic (`ColumnDef<Row>`).

No change to any component's props, DOM, or behaviour. `Table` and `VirtualTable` keep the same
public API, including `data`, `columns`, `pageSize`, `emptyMessage`, `filterable`, and
`filterPlaceholder`, and the exported `ColumnDef<T>` type keeps the shape it had under v8.

This deliberately does **not** use `@tanstack/react-table/legacy`, the library's `@deprecated`
v8 compatibility shim, so no deprecated import reaches consumers. Features are registered
individually rather than via `stockFeatures`, keeping grouping, pinning, resizing, selection,
faceting, and expanding out of your bundle.
