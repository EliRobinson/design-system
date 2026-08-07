# Prompt: add a new component to the design system

Fill in the bracketed fields, then hand this whole file to the agent.

---

Add a `[ComponentName]` component to `@elirobinson/react`.

**What it should do:** [one paragraph — the job this component does and the states it has.
If it maps to a shadcn/ui component, name it.]

## Intent

The component must feel native to the Miltinson system: token-styled, keyboard-complete,
and documented. shadcn/ui is the reference for API shape and accessibility patterns only —
never its styles and never a Tailwind dependency.

## Context to load first

- `docs/agents/components.md` — tier boundary rule, touch-target policy, shadcn adoption
  policy, FormField-vs-Input precedent.
- `@elirobinson/ai-patterns/contracts` (`componentConstraints`) — the machine-checkable
  rules you are subject to.
- The docs site's `/llms-full.txt` (or `design-system-docs/preview/` in this repo) — the
  canonical look of buttons, fields, cards, and tags.
- Two existing components in the target tier, read end to end, as the pattern to match.

## Constraints

- Place it by the tier boundary rule: portal/focus-trap/multi-element open state →
  `organisms/`; assembled from 2+ atoms without that → `molecules/`; else `atoms/`.
- `forwardRef` to the outermost interactive element it owns.
- Touch targets by role: 44×44px minimum for primary controls; shadcn/MUI dense scale for
  inline affordances; an expanded hit area must never overlap sibling content.
- Styles in a sibling `<Name>.css` using only `--*` tokens via `ds-*` classes; add its
  `@import` to `packages/react/src/styles.css` at the end of the cascade — never reorder
  existing lines.
- Keyboard behavior via the shared hooks (`useRovingFocus`, `useActiveDescendant`,
  `useEscapeKey`, `useClickOutside`, `useAnchoredPosition`) before writing new key
  handlers.
- No barrel files: the component is consumed as
  `@elirobinson/react/components/<tier>/<Name>`.
- No new runtime dependencies without explicit sign-off.

## Verification checklist

- [ ] `pnpm build && pnpm lint && pnpm typecheck && pnpm test` pass from the repo root.
- [ ] Tests cover the keyboard contract the component claims (arrows/Escape/Home/End as
      applicable) — the test file is the contract's source of truth.
- [ ] A Storybook story exists in `apps/storybook` showing realistic usage.
- [ ] The docs build (`pnpm nx run docs:build`) picks the component up in
      `component-manifest.json` with no extraction gaps, and a docs page exists at
      `/components/<slug>` following the Button page's structure.
- [ ] Every color pairing introduced passes WCAG AA (compute it — don't eyeball it).
- [ ] Focus is visible on every interactive element; `prefers-reduced-motion` is not
      overridden.
