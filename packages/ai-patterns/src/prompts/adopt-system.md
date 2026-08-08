# Prompt: adopt the design system in an existing app

Fill in the bracketed fields, then hand this whole file to the agent.

---

Bring `[app name / path]` onto the Miltinson Design System (`@elirobinson/tokens` +
`@elirobinson/react`).

**Scope for this pass:** [which routes/screens to migrate now; anything explicitly out of
scope.]

## Intent

Replace ad-hoc primitives and hardcoded style values with the system, without a big-bang
rewrite — each step should leave the app shippable.

## Context to load first

- The docs site's `/llms-full.txt` — component inventory with exact import subpaths and
  prop tables, token names with values, and the system constraints.
- `@elirobinson/ai-patterns/contracts` — the machine-checkable rules to enforce.

## Constraints

- Work in the documented order: (1) swap primitive buttons/inputs/cards for system
  components, (2) move style values onto `--*` tokens, (3) keyboard and focus pass.
- Imports use package subpaths only — `@elirobinson/react/components/<tier>/<Name>` — a
  bare `@elirobinson/react` import does not resolve.
- `@elirobinson/tokens/tokens.css` and `@elirobinson/react/styles.css` are imported once,
  in the app shell, in that order.
- `Input`/`Textarea`/`Select` require a `label` prop; do not wrap them in `FormField`
  (double labels). `FormField` is for controls without their own wiring.
- Reference semantic tokens (`--fg`, `--surface`, `--accent`) — never raw scale values
  (`--ink-500`) in app code.
- Spacing values snap to the `--space-*` scale; radii to `--radius-*`; no magic numbers
  survive the pass.
- Delete `outline: none` on focus wherever found — the token stylesheet's focus ring is
  non-negotiable.
- Do not restyle system components with overrides that fight the tokens; if a component
  can't do the job as shipped, report the gap instead of forking its styles.

## Verification checklist

- [ ] The app builds and its existing tests pass after each of the three steps, not just
      at the end.
- [ ] No hardcoded hex/px style values remain in the migrated scope (grep for `#`, `px`
      values outside token definitions, and inline `style=` blocks; list justified
      exceptions).
- [ ] Every migrated screen is fully operable with the keyboard alone, with visible focus
      throughout.
- [ ] Touch targets follow the scoped policy — 44×44px primary controls, dense scale for
      inline affordances, no overlapping hit areas.
- [ ] A short migration report: what was swapped, what was left, and any place the system
      was missing a component the app needed.
