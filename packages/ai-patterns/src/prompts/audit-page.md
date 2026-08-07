# Prompt: audit a page for token and accessibility compliance

Fill in the bracketed fields, then hand this whole file to the agent.

---

Audit `[route or file path]` in `[app]` against the Miltinson Design System's contracts.
Report findings; fix only what's listed under "fix directly" below.

## Intent

A page that uses the system should be provably on-system: token-clean, AA-contrast,
keyboard-complete. This audit produces a findings list a maintainer can act on — honest
about severity, free of nitpicks dressed up as blockers.

## Context to load first

- `@elirobinson/ai-patterns/contracts` — `uiContracts` and `componentConstraints` are the
  rulebook; cite the constraint id in every finding.
- The docs site's `/llms-full.txt` — token names/values and each component's documented
  accessibility contract.

## What to check

1. **Imports** — every `@elirobinson/*` import names a subpath (`no-barrel-imports`);
   flag any deep import into package internals.
2. **Tokens** — hardcoded colors, px spacing, radii, shadows, or durations that have a
   token equivalent; raw scale tokens (`--ink-500`) where a semantic token belongs.
3. **Contrast** — compute WCAG ratios for text/background pairings introduced by the
   page; AA is the floor (4.5:1 normal text, 3:1 large).
4. **Touch targets** — `touch-target-primary` (44×44px) for buttons/pagination/nav
   items; `touch-target-dense` for chip-remove/clear/stars/day-cells;
   `hit-area-no-overlap` everywhere (check computed geometry, not intent).
5. **Keyboard and focus** — tab reach and order, visible `:focus-visible` on every
   control, Escape/arrow behavior matching each component's documented contract, focus
   return on overlay close, no `outline: none`.
6. **Semantics** — labels on every control (`aria-label` on icon-only buttons), one `h1`,
   sane heading order, `alt` on images, live regions only where the system provides them.

## Constraints

- **Fix directly:** token substitutions with identical rendered results, missing
  `aria-label`s, `outline: none` deletions.
- **Report, don't fix:** layout changes, color changes that alter the design, component
  swaps, anything touching behavior.
- Every finding cites the file/line, the constraint id, and the concrete fix.
- No hype, no padding — if the page is clean, say it's clean.

## Verification checklist

- [ ] Findings each carry: location, constraint id, severity (blocker / should-fix /
      note), and a concrete remedy.
- [ ] Contrast claims include the computed ratio, not an adjective.
- [ ] The app builds and tests pass after the direct fixes.
- [ ] The report ends with the three most valuable fixes, ranked.
