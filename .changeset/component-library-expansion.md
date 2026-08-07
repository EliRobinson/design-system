---
'@elirobinson/react': major
---

Move every published component under an atomic-tier subpath (`atoms/`, `molecules/`, `organisms/`) and add 19 new components plus a `useDsForm` hook.

**Breaking: import paths now include the atomic tier.**

```diff
- import { Button } from '@elirobinson/react/components/Button';
+ import { Button } from '@elirobinson/react/components/atoms/Button';
```

Every existing component moved to its tier — e.g. `Card`/`Alert`/`Badge` → `components/molecules/`, `Dialog`/`Select`/`Tabs` → `components/organisms/`, `Button`/`Input`/`Avatar` → `components/atoms/`. See `docs/agents/components.md` for the full tier boundary rule and the shadcn mapping table.

New components, by tier:

- **atoms**: `RadioGroup`/`RadioGroupItem`, `Spinner`, `Slider`, `Kbd`
- **molecules**: `Chip`, `FormField`, `SearchField`, `Pagination`, `Stepper`, `SegmentedControl`, `EmptyState`, `Rating`
- **organisms**: `VirtualList`, `Accordion`, `DatePicker`, `Combobox`, `Table`, `NavigationMenu`, `CommandPalette`
- **hooks**: `useDsForm` (`@elirobinson/react/hooks/useDsForm`)

New dependencies: `@tanstack/react-table`, `@tanstack/react-virtual`, `@tanstack/react-form`.
