# Brief: writing a component doc page (docs site)

You are writing documentation pages for the Miltinson Design System docs site at
`apps/docs` in the worktree `/Users/elirobinson/Code/design-system-docs-site`. Follow this
brief exactly; the Button page is the exemplar and this file is the contract.

## The exemplar — read these files first

- Page: `apps/docs/src/app/(docs)/components/button/page.mdx`
- Demos: `apps/docs/src/components/demos/button/*.tsx`
- Available building blocks: `apps/docs/src/components/docs/` (ComponentHeader, DemoBlock,
  PropsTables, DoDont, RelatedComponents, CodeSnippet)
- The manifest record for your component: run `pnpm nx build react`, then search
  `packages/react/dist/manifest.json` for its name (slug, import path, props,
  sub-components — do not restate these by hand; ComponentHeader and PropsTables render
  them).

## Files you create per component

1. `apps/docs/src/app/(docs)/components/<slug>/page.mdx`
2. `apps/docs/src/components/demos/<slug>/<Section>.tsx` — one file per demo section,
   `'use client';` first line, default export, imports from
   `@elirobinson/react/components/<tier>/<Name>` (never a bare package import).

Do not touch any other file. No git commands. Do not modify component source in
`packages/react/`.

## Page structure (same order as Button)

1. `<ComponentHeader slug="<slug>" />`
2. A basic-usage `DemoBlock`
3. `## When to use it` — honest judgment prose: when to reach for it, when a neighbor
   component is the better call.
4. Variant/state/behavior sections, each a `DemoBlock` — together they must cover the
   real prop surface (every variant/size/state enum value, controlled vs uncontrolled
   where the component supports both, empty/error states where relevant).
5. `## Props` → `<PropsTables slug="<slug>" />`
6. `## Accessibility` — the real keyboard contract and ARIA pattern. Derive it by
   reading the component source (and its `.test.tsx`, which encodes the contract; the
   story in `apps/storybook/src/stories/<Name>.stories.tsx` shows realistic usage).
   Never invent behavior — if the component doesn't handle a key, don't claim it does.
7. `<DoDont do={[…]} dont={[…]} />` — 3–4 items each, concrete, not generic.
8. `## Related` → `<RelatedComponents slugs={[…]} />` — 2–4 slugs from the valid list
   below.

`export const metadata = { title: '<Name>' };` at the top after imports.

## Demo rules

- Demos render inside a bordered stage. Use `className="demo-row"` (horizontal wrap) or
  `"demo-col"` (stacked, max 360px) for layout; no inline styles unless a demo genuinely
  needs a fixed height (e.g. VirtualList).
- The demo file's source is displayed verbatim under "Show code" — write it as the code
  you'd want a reader to paste: realistic content, no `foo`/`bar`, Miltinson-flavored
  sample data (apps, coaching guides, recipes, invoices — see the voice notes).
- Local state via `useState` for controlled components. Keep each demo self-contained.
- Compound components: show the full composition (e.g. Dialog + DialogTrigger +
  DialogContent + DialogTitle + DialogFooter + DialogClose).
- Special cases: `Toast` requires wrapping in `Toaster` and dispatching via `useToast`;
  `VirtualList`/`VirtualTable` need an explicit `height`; `Table` needs `ColumnDef`
  columns (re-exported from the Table module); `CommandPalette` is opened from a button.
  Read the story file when in doubt.

## Voice (from design-system-docs/miltinson.voice.json — the authority; README.md renders it)

- The voice is Miltinson Technologies. "I" or "we" is the product's call, held
  consistently within a surface. Reader is "you".
- Sentence case headings. Em-dashes as the favored break. No emoji.
- Practical, honest, warm, quietly confident — in that order. Banned words:
  leverage, seamless, robust, empower, unlock, cutting-edge, revolutionary.
- Don't pad: if a section has nothing real to say, say less.

## MDX gotchas

- In prose, wrap HTML element names and generics in backticks: `` `<dialog>` ``,
  `` `ColumnDef<T>` `` — bare `<` starts JSX and `{` starts an expression.
- Imports use the `@/` alias: `import Basic from '@/components/demos/<slug>/Basic';`
- Component names in prose: backticks on first mention per section is enough.

## Valid related-component slugs

accordion, alert, avatar, badge, breadcrumb, button, card, checkbox, chip, combobox,
command-palette, date-picker, dialog, dropdown-menu, empty-state, eyebrow, form-field,
input, kbd, label, navigation-menu, pagination, popover, progress, radio-group, rating,
rule-link, search-field, segmented-control, select, separator, sheet, skeleton, slider,
spinner, stepper, switch, table, tabs, textarea, toast, tooltip, virtual-list,
virtual-table

## Verification (scoped)

After writing your pages, typecheck only your demo files compile:

```bash
cd /Users/elirobinson/Code/design-system-docs-site/apps/docs && pnpm exec tsc --noEmit --incremental false -p tsconfig.json
```

Other agents are writing other tiers concurrently — if errors point at files outside
your assignment, ignore them (do not edit those files); report them instead. Do not run
`next build` (it collides across agents). Report back: pages written, demos per page,
any component whose behavior surprised you, any typecheck errors left.
