# AI Agent Rules

> Canonical agent instructions for this repo. `CLAUDE.md` is a symlink to this file — edit here only.

## Commits

Always use conventional commit messages.

## Design System

This repo publishes `@elirobinson/tokens`, `@elirobinson/react`, and `@elirobinson/ai-patterns`. The `Miltinson Design System/` folder is the brand source of truth — tokens, preview swatches, UI kits, and agent skill.

### Token-first rule

- Import `@elirobinson/tokens/tokens.css` in every app shell.
- Never hardcode spacing, radii, colors, or durations — use CSS custom properties from tokens.
- Reference semantic tokens (`--fg`, `--surface`, `--accent`, etc.) in components, not raw scale values (`--ink-500`).

### shadcn component adoption

When pulling a new component from [shadcn/ui](https://ui.shadcn.com/), **do not install Tailwind or copy shadcn styles verbatim**. Instead:

1. **Use shadcn for API shape and accessibility patterns** — prop names, compound subcomponents (e.g. `CardHeader`, `DialogContent`), ARIA roles, keyboard behavior, and focus management.
2. **Style against Miltinson tokens** — every visual value must come from `@elirobinson/tokens/tokens.css` via `ds-*` classes in `packages/react/src/styles.css`.
3. **Match brand preview swatches** — check `Miltinson Design System/preview/` for the canonical look of buttons, fields, cards, tags, and layout patterns before styling.
4. **Follow existing conventions** — `ds-` prefix for classes, `forwardRef` for interactive elements, 44px minimum touch targets, visible `:focus-visible` rings using `--focus-ring`.
5. **Export from `@elirobinson/react`** — add the component to `packages/react/src/index.ts` and a Storybook story in `apps/storybook/`.
6. **Skip Radix/Tailwind dependencies** unless explicitly requested — implement with native HTML elements and React state, styled with token CSS.

#### shadcn → Miltinson mapping reference

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

### Layout patterns (not packaged)

Header, Footer, Hero, Sidebar, TopBar, and StatCard are **app-specific layout compositions**. Prototype them in `Miltinson Design System/ui_kits/` and compose in apps from `@elirobinson/react` primitives. See Storybook **Patterns/Marketing** for examples.

### AI pattern alignment

- Keep prompts and AI UX contracts in `@elirobinson/ai-patterns`.
- Enforce practical tone and avoid hype language in generated copy.
- Follow `packages/ai-patterns/src/contracts.json` for touch targets, focus-visible, and WCAG AA contrast.

### Publishing

- Publish packages to GitHub Packages via Changesets on merge of the release PR.
- Consumer apps need a `.npmrc` scoped to `@elirobinson` and a `NODE_AUTH_TOKEN` with `read:packages`.
