# Web App UI Kit

An app with a sidebar and six screens, each built from the real `@elirobinson/react`
components:

- **Dashboard** (`#/`) — Alert, stat Cards with Badges, Progress, Avatar activity, Stepper, Toast
- **Projects** (`#/projects`) — project Cards under the CommandPalette (groups, shortcuts, a loading row). ⌘K opens it on every screen.
- **Invoices** (`#/invoices`) — DropdownMenu with checkbox and radio items, an icon Button with a `labelOnly` Tooltip, SearchField, SegmentedControl, removable Chips, a paginated Table
- **Assistant** (`#/assistant`) — ChatThread, ChatMessage, DecisionCard, StreamingCaret, a Textarea composer
- **Settings** (`#/settings`) — Breadcrumb, Tabs, Inputs and a Select with errors, `FieldError` for a checkbox group, RadioGroup, Switch, a `destructive` Button; the Security tab puts `hideLabel` Switches in a Table
- **Onboarding** (`#/onboarding`) — Stepper, RadioGroup, Slider, EmptyState, Spinner, Skeleton

**Files**

- `Shell.jsx` — `AppShell` (sidebar, hash routing, the command palette) and `PageHeader`
- `Screens.jsx` — the six screens

The components come from `../_shared/ds-bundle.js`; nothing here draws its own copy of
one. Every string comes from `../_shared/content.js`.

Open `index.html`. The bar at the top sets the theme and the palette; so does the query
string, as in `index.html?theme=dark&palette=steady#/invoices`.
