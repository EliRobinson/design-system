# Components

## Component adoption order

When bringing an app onto the design system:

1. Replace primitive `button`, `input`, and card wrappers with `@elirobinson/react`.
2. Move style values to CSS custom properties from tokens.
3. Keep all interactions keyboard accessible and focus-visible compliant.

## shadcn component adoption

When pulling a new component from [shadcn/ui](https://ui.shadcn.com/), **do not install Tailwind or copy shadcn styles verbatim**. Instead:

1. **Use shadcn for API shape and accessibility patterns** — prop names, compound subcomponents (e.g. `CardHeader`, `DialogContent`), ARIA roles, keyboard behavior, and focus management.
2. **Style against Miltinson tokens** — every visual value must come from `@elirobinson/tokens/tokens.css` via `ds-*` classes in `packages/react/src/styles.css`.
3. **Match brand preview swatches** — check `design-system-docs/preview/` for the canonical look of buttons, fields, cards, tags, and layout patterns before styling.
4. **Follow existing conventions** — `ds-` prefix for classes, `forwardRef` for interactive elements, 44px minimum touch targets, visible `:focus-visible` rings using `--focus-ring`.
5. **Export from `@elirobinson/react`** — add the component under `packages/react/src/components/<tier>/` (consumers import `@elirobinson/react/components/<tier>/<Name>`) and a Storybook story in `apps/storybook/`.
6. **Skip Radix/Tailwind dependencies** unless explicitly requested — implement with native HTML elements and React state, styled with token CSS.

## Atomic tiers

Components live under `packages/react/src/components/<tier>/`:

- **atoms/** — single-purpose, not further divisible (e.g. `Button`, `Input`).
- **molecules/** — a few atoms combined into one functional unit, no portal/overlay orchestration (e.g. `Card`, `Alert`).
- **organisms/** — compound components with internal state and/or overlay orchestration: portals, focus trapping, keyboard nav (e.g. `Dialog`, `Select`).

Boundary rule: if a component renders into a portal, traps focus, or manages open/closed state across multiple sub-elements, it's an organism. If it's assembled from 2+ atoms with no such orchestration, it's a molecule. Otherwise it's an atom.

Import via the tiered subpath: `@elirobinson/react/components/<tier>/<Name>`.

### Constraints (all components, all tiers)

- Every component that renders a focusable/interactive native element uses `forwardRef`, forwarding to the outermost interactive/native element the component owns.
- Every interactive control has a minimum 44x44 touch target. Where visual density matters, keep the painted glyph small and expand the hit area (padding, or a `::after` overlay with `position:absolute; inset:-Npx`) rather than inflating the visible control.

### FormField vs Input

- **`Input`** (`atoms/Input`) is the batteries-included labelled control: it requires a
  `label` prop and renders its own `<label>`, hint, error text, and `aria-describedby`/
  `aria-invalid` wiring. Reach for it whenever the control is a plain `<input>`.
- **`FormField`** (`molecules/FormField`) wraps an arbitrary or third-party control that
  does not do its own label/hint/error wiring. It owns the `<label>` and message markup
  and hands the child a render-prop bundle (`aria-describedby`, `aria-invalid`) to spread
  onto that control. Do not nest `Input` inside `FormField` — `Input` already renders its
  own label and message region, so wrapping it produces duplicate labels.

## shadcn → Miltinson mapping reference

| shadcn component                                         | Miltinson equivalent / notes                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Badge                                                    | `Badge` — maps to preview tags (default, signal, anchor, solid, outline) |
| Button                                                   | `Button` — primary, accent, secondary, ghost; sm/md/lg sizes             |
| Card                                                     | `Card` + subcomponents — matches preview portfolio cards                 |
| Input, Textarea, Select, Label                           | Form primitives — match `components-fields.html` preview                 |
| Alert                                                    | `Alert` — status tokens for success/warning/danger/info                  |
| Separator                                                | `Separator` — `--border` hairline                                        |
| Tabs                                                     | `Tabs` — ink underline active state                                      |
| Dialog                                                   | `Dialog` — native `<dialog>` with token surfaces                         |
| DropdownMenu, Popover, Tooltip, Sheet, Toast             | Overlay primitives — portal positioning, keyboard nav, aria-live toasts  |
| Avatar, Breadcrumb, Checkbox, Switch, Skeleton, Progress | Styled per tokens; check UI kits for context                             |
| Eyebrow, RuleLink                                        | Marketing typography primitives from ui_kits                             |
