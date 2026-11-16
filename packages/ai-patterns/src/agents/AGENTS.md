<!-- design-system:begin -->
<!-- Managed by `elirobinson-ds init --agents`. Edit above or below this block,
     not inside it. Re-running init replaces everything between the markers. -->

## UI: design system first

All UI in this repo is built from `@elirobinson/react` (components, hooks), `@elirobinson/tokens` (color, type, space, radius, shadow, motion), and `@elirobinson/ai-patterns` (UI contracts, working patterns, prompt templates). Upstream: https://github.com/EliRobinson/design-system

Component lists, token lists, and prop signatures go stale with each release, so ask the installed packages instead of relying on a remembered or pasted copy:

```bash
pnpm ds                  # components (+ exports & variants), hooks, typography classes, token groups
pnpm ds props <Name>     # props, variant unions, and the exact import line to copy
pnpm ds tokens [filter]  # tokens and their values
pnpm ds classes [filter] # CSS classes the design system ships
pnpm ds contracts        # machine-checkable UI rules, each with its check and what verifies it
pnpm ds patterns         # working principles and the definition of done for UI work
pnpm ds prompts [name]   # reusable prompt templates
pnpm ds check            # known traps that fail with no error; run after setup and every upgrade
```

`pnpm exec elirobinson-ds` is the same command if the `ds` script is not wired up.

### Rules

- Import each component by its full subpath. There is no barrel export, so a bare `@elirobinson/react` import does not resolve.
- Set appearance with a component's own `variant` / `size` props. Use utility classes for layout only, because the design system owns the look.
- Take colors, radii, shadows, durations, and font sizes from tokens: mapped utilities, `.t-*` classes, or `var(--token)`. Do not use literal values.
- On Tailwind v4, order the CSS entry as `@import 'tailwindcss'`, then the design system stylesheet (`@elirobinson/react/styles.css`, or `@elirobinson/tokens/tokens.css` for an app that does not import `styles.css`), then `@import '@elirobinson/tokens/tailwind.css'`. That last import maps the Tailwind color namespace onto the tokens. Without it, utilities like `bg-background` resolve to nothing.
- Dark mode is `[data-theme="dark"]` (`.dark` also works). With `next-themes`, set `attribute="data-theme"`.
- Put token overrides in an unlayered `:root` block. `tokens.css` is unlayered, so an override inside `@layer base` silently loses to it. With `next/font`, re-point the families through `--ds-font-sans-override` / `--ds-font-mono-override` instead, with the font class on `<html>`.
- Import `@elirobinson/react/styles.css` once, in the app shell, not per component. It already imports `@elirobinson/tokens/tokens.css`; importing `tokens.css` as well bundles it twice. An app that does not import `styles.css` (no React, or per-component sheets only) imports `@elirobinson/tokens/tokens.css` itself.
- When a piece is missing, compose it from primitives, then use the repo's sanctioned gap-filler, then hand-roll it from tokens and flag it as a design system gap worth upstreaming.
- `@elirobinson/eslint-config` blocks foreign UI libraries, direct Radix imports, bare `@elirobinson/*` imports, and hardcoded design values.
- Contract checks that need a browser (touch targets, visible focus, WCAG AA contrast) come from `@elirobinson/ai-patterns/testing/playwright`. Add them to the E2E suite, because lint cannot measure them.

### UI copy

Functional copy is chrome: errors, empty states, helper and hint text, toasts, labels, button text, tooltips, confirmations, and validation. State the fact, then the consequence, then the action, and stop. Leave out:

- Unverifiable frequency claims ("almost always", "this rarely happens"), because you do not have that data.
- Blame attribution ("on their side", "check your connection"). Say what is observable, not whose fault it might be.
- Filler pacing ("in a moment", "hang tight").
- Unprompted reassurance or apology ("don't worry", "we'll sort it out"). Reassurance is fine when it answers a question the reader is actually asking, and then it is a fact: "You have not been charged."
- Escalation paths nobody asked for ("if it keeps happening, reply to..."). They belong in a support surface, not a control.
- Enthusiasm ("Great news!", exclamation marks).

```
❌ You have not been charged. This is almost always a passing blip on their side,
   so try again in a moment. If it keeps happening, reply and we'll sort it out.
✅ You have not been charged. Try again.
```

This rule covers chrome, not this product's editorial voice. Marketing prose, conversational surfaces, and written deliverables are content, and their voice is a deliberate design decision. On a surface that mixes the two, chrome follows this rule. Applying it to the content would flatten the product's voice, which does more harm than the padding it removes.

If functional copy runs past two short sentences, it is explaining, reassuring, or selling, so cut it back. `@elirobinson/eslint-config` reports the literal phrases, over copy props and chrome components only. It does not read ordinary prose. It ships at `warn` so an upgrade cannot fail a build. Raise it to `error` once your copy is clean: `designSystem({ copy: { severity: 'error' } })`.

Before calling UI work done, run `pnpm ds patterns` and work through the Definition of Done for UI work checklist it prints.

<!-- design-system:end -->
