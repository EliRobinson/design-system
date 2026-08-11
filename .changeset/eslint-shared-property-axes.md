---
'@elirobinson/eslint-config': minor
---

no-hardcoded-design-values: the JS/JSX and CSS rules now share one definition of which **property** belongs to which axis, completing the unification the previous change started on values.

Each rule kept its own list — a camelCase `Set` in JS, a regex in CSS — and they had drifted. `filter: drop-shadow(0 4px 8px #000)` was an error in a `.tsx` style object and silent in a `.css` file; `column-rule-color` was a colour property in JS only; a colour-only `text-shadow` reported messageId `shadow` in JS but `color` in CSS. Both rules now resolve a property through `axisOf` in `value-patterns.mjs`, which normalises either spelling to the same key, and the axis picks the value test — so membership and the reported id cannot diverge again. The parity table in `index.test.mjs` gained a property dimension asserting on **message ids** rather than prose, plus a check that every shared property maps to exactly one axis in both spellings.

Divergences were reconciled one at a time rather than unioned, so this both widens and narrows what is flagged.

- **Breaking, changed message id:** a `box-shadow` or `text-shadow` whose only literal is a colour (`text-shadow: 0 0 rgb(0 0 0 / .5)`) now reports `shadow` in CSS, not `color`. Those properties belong to the shadow axis outright — "use a shadow token" is the more actionable message, and it is what JS already reported. If you pin `color` for these declarations in an `eslint-disable-next-line` comment or a severity override, repoint it at `shadow`.
- **New CSS errors:** `filter` and `backdrop-filter` are now on the shadow axis, so `filter: drop-shadow(0 4px 8px #000)` is flagged (it always was in JS). `column-rule-color` is now a colour property, and the one-sided logical border colours — `border-inline-start-color` and its three siblings — join the two-sided ones the old regex already matched.
- **New JS errors:** logical properties now match their physical counterparts, so `borderStartStartRadius` is a radius and `borderBlockColor` is a colour, as they have always been in CSS. Kebab-case keys in a style object (`{ 'background-color': '#fff' }`) now resolve to their axis too, instead of being skipped.
- **Fewer JS errors:** `filter` and `backdrop-filter` reach the shadow axis only through `drop-shadow()`. `filter: blur(4px)` was reported as a hardcoded shadow, which pointed at advice no shadow token could satisfy — a blur radius is not an axis this design system owns. It is now silent in both languages. An `eslint-disable` comment covering one of these becomes an unused directive; delete it, or run with `--report-unused-disable-directives` to find them.

Tailwind arbitrary values in `className` are keyed off the utility, not a CSS property, and have no CSS counterpart to drift against — that path is unchanged.
