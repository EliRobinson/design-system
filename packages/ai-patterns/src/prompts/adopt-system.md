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

Do not work from a remembered or documented inventory — ask the installed packages:

```bash
pnpm ds                  # components, exports, variants, hooks, typography, token groups
pnpm ds props <Name>     # props, variant unions, and the exact import line to copy
pnpm ds tokens [filter]  # tokens and values
pnpm ds contracts        # the machine-checkable rules to enforce, and what verifies each
pnpm ds patterns         # working principles and the definition of done
```

`pnpm exec elirobinson-ds` works before the `ds` script exists.

## Step 0 — wire up the tooling

Before migrating any screen, install the things that keep this from drifting back:

1. `pnpm add @elirobinson/react@latest @elirobinson/tokens@latest` and
   `pnpm add -D @elirobinson/ai-patterns@latest @elirobinson/eslint-config@latest`.
2. Add `"ds": "elirobinson-ds"` to `scripts`, so every instruction above resolves.
3. Extend the flat ESLint config with `@elirobinson/eslint-config` (and
   `@elirobinson/eslint-config/css` if the app has its own stylesheets). This is what
   makes the import bans and the no-hardcoded-values rule fail the build rather than
   depend on review.
4. `pnpm ds init --agents` — installs the Claude Code skill, the Cursor rule, the Copilot
   instructions, and an `AGENTS.md` block. Coverage matters: teammates drive different
   tools, and an agent only follows what it actually loads.
5. On Tailwind v4, add `@import '@elirobinson/tokens/tailwind.css'` after the tokens
   import. Without it, `bg-background` and friends resolve to nothing.
6. If the app has a theme switcher, point it at `data-theme` (`next-themes`:
   `attribute="data-theme"`).
7. Drop `expectDesignSystemContracts` from `@elirobinson/ai-patterns/testing/playwright`
   into the E2E suite for the routes in scope.

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
- [ ] `pnpm lint` passes with `@elirobinson/eslint-config` enabled — that is the check for
      hardcoded values and stray imports, rather than a grep whose exceptions nobody
      revisits.
- [ ] The Playwright contract check passes on every migrated route: touch targets, visible
      focus, and WCAG AA contrast.
- [ ] Every migrated screen is fully operable with the keyboard alone.
- [ ] Every migrated screen renders correctly under `data-theme="dark"`.
- [ ] The full checklist in `pnpm ds patterns` — **Definition of Done for UI work** —
      holds.
- [ ] A short migration report: what was swapped, what was left, and any place the system
      was missing a component the app needed.
