---
'@elirobinson/react': minor
---

Two residuals from #81, in one package.

`DecisionCard` gains `headingLevel` (2–6, default 2) and renders `headline` as the
real heading element. It shipped as a `<p class="ds-decision__headline">`, so the
card had no title in the document outline and a screen reader's heading navigation
skipped every DecisionCard on the page. The treatment matches `Accordion`'s — a tag
map, a runtime fallback for an out-of-range level so a value from outside the type
boundary cannot throw `Element type is invalid` and take the tree down, and the type
ramp carried by the class so every level looks identical. The range starts at 2
where `Accordion`'s starts at 1: an accordion can be the only thing on a page, and a
card that claimed the document's `<h1>` would be claiming to be the page.

`ChatMessage`'s avatar frame is now an `Avatar` at its `md` step (40px) instead of a
hand-rolled 44px box. It carried the comment "44x44 is the floor for an avatar in
this system"; there is no such floor. `docs/agents/components.md` scopes the 44px
floor to primary interactive controls, and this frame is `aria-hidden` and
unfocusable — a decorative mark, on the ordinary avatar scale like every other
avatar. The element now carries `ds-avatar ds-avatar--md` alongside its own class,
so the circle's size, fill and radius come from `Avatar.css` and are not restated;
what stays here is the hairline `--border-control` edge and the mark colour. The
fill moves with it, from `--surface-2` to `Avatar`'s `--bg-muted`, so the mark
measures 6.24:1 light / 11.51:1 dark (was 6.66:1 / 11.51:1) and the edge 3.26:1 /
4.00:1 — both still clear, and both are now measured rather than asserted by name.

Minor rather than patch: `headingLevel` is an addition to a published prop surface.
No prop was removed or retyped, and the only behavioural change to existing calls is
that `headline` is an `<h2>` — which is the fix. The 4px avatar change is visible,
so it is called out here rather than left for a consumer to discover in a diff.
