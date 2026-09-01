---
'@elirobinson/react': minor
---

Anchored panels that fit on neither side now shift into the viewport

A DropdownMenu, Popover or Tooltip whose panel fits on neither side of its
trigger no longer stays where it was asked to go and overflow. It keeps its
width — including the `--anchored-min-width` floor — and slides along the axis
until it is back inside the viewport. The panel stops being edge-aligned with
its trigger, and may overlap it, but it never narrows and never reflows.

That is the answer to the question #195 left open. A clamp was the alternative,
and a clamp is what causes the bug: a `position: fixed` panel with no width is
shrink-to-fit, so capping its width does not crop it, it wraps the content
(#180). Moving the panel avoids the choice between overflowing and wrapping
entirely.

A panel taller than the viewport fits at no offset at all. That one — and only
that one — takes a `max-height` of the viewport and scrolls its own content.
