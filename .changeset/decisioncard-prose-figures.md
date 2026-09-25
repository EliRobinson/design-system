---
'@elirobinson/react': minor
---

`DecisionCard` can now draw a derivation (#258). Three opt-ins, and a card that uses none of them renders the same markup as before:

- `figureLayout="prose"` draws `figures` as a two-column grid — a small mono label beside a left-aligned sans sentence — for values that are sentences rather than metrics. The default is `metric`, the existing right-aligned mono layout.
- `code` sets a short identifier apart before `headline`, in mono on the headline's baseline. It renders inside the heading, so the heading's accessible name stays one phrase.
- `DecisionFigure` takes an optional `id`, used as the figure's React key and never rendered. Without one a figure is keyed by its position, so repeated labels no longer need a unique `kind`.
