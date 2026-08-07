---
'@elirobinson/react': major
---

Move every published component under an atomic-tier subpath (`atoms/`, `molecules/`, `organisms/`) and add 19 new components.

**Breaking: import paths now include the atomic tier.**

```diff
- import { Button } from '@elirobinson/react/components/Button';
+ import { Button } from '@elirobinson/react/components/atoms/Button';
```

Every existing component moved to its tier — e.g. `Card`/`Alert` → `components/molecules/`, `Badge`/`Button`/`Input`/`Avatar` → `components/atoms/`, `Dialog`/`Select`/`Tabs` → `components/organisms/`. See `docs/agents/components.md` for the full tier boundary rule and the shadcn mapping table.

New components, by tier:

- **atoms**: `RadioGroup`/`RadioGroupItem`, `Spinner`, `Slider`, `Kbd`
- **molecules**: `Chip`, `FormField`, `SearchField`, `Pagination`, `Stepper`, `SegmentedControl`, `EmptyState`, `Rating`
- **organisms**: `VirtualList`, `Accordion`, `DatePicker`, `Combobox`, `Table`, `VirtualTable`, `NavigationMenu`, `CommandPalette`
- **hooks**: `useActiveDescendant`, `useRovingFocus`

New dependencies: `@tanstack/react-table`, `@tanstack/react-virtual`.

**Per-component stylesheets.** `@elirobinson/react/styles.css` is unchanged as the
single entry point and still carries every component. Individual stylesheets are
now also importable for consumers who want to pull in only what they use:

```ts
import '@elirobinson/react/styles/atoms/Button.css';
```
