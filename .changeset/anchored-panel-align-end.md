---
'@elirobinson/react': minor
---

An anchored panel can pin its right edge to its trigger, and its inline min-width is a floor again.

A `DropdownMenu` whose avatar trigger sat at the far right of a header opened 95px wide against
`.ds-dropdown__content`'s own `min-width: 180px` — every item wrapped, the label onto three lines
(#180). Two independent causes, both fixed here.

`useAnchoredPosition` only ever set `left`. A `position: fixed` panel with no width is sized by
what is left of the viewport beside the edge that is pinned, so a trigger near the right edge does
not merely overflow — the panel is _resized_ and its content reflows. `align` now takes `'end'`,
which pins the panel's right edge to the trigger's and releases `left`, and `DropdownMenuContent`
and `PopoverContent` forward `side` and `align` through to the positioner, which neither did
before:

```tsx
<DropdownMenuContent align="end">…</DropdownMenuContent>
```

Separately, the inline `min-width: <trigger width>` the positioner writes for a start-aligned
panel is meant as a floor ("at least as wide as its trigger") but read as an override, so it
deleted the panel's own minimum for every trigger narrower than it — every icon or avatar trigger.
It is now written as `max(var(--anchored-min-width, 0px), <trigger width>)`, and
`.ds-dropdown__content` declares `--anchored-min-width: 180px` beside its `min-width`. The number
stays in the stylesheet, where it belongs; a panel that declares no floor falls back to `0px` and
is sized by its trigger exactly as before.

One internal note for anyone composing the overlay parts directly: `useAnchoredOverlay` no longer
runs `useAnchoredPosition`. `AnchoredOverlayContent` does, because that is where `side` and `align`
arrive. Using the two together, as `DropdownMenu` and `Popover` do, is unchanged.
