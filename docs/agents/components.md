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
5. **Export from `@elirobinson/react`** — add the component to `packages/react/src/index.ts` and a Storybook story in `apps/storybook/`.
6. **Skip Radix/Tailwind dependencies** unless explicitly requested — implement with native HTML elements and React state, styled with token CSS.

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
