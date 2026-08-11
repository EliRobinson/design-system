---
'@elirobinson/eslint-config': minor
---

no-hardcoded-design-values: the JS/JSX and CSS rules now share one definition of which **property** belongs to which axis — colour, radius, shadow or motion.

The previous release shared what counts as a hardcoded _value_ and left the property half per-language: a camelCase `Set` in the JS rule, a kebab-case regex in the CSS one. Those had drifted the same way the regexes had. `filter: drop-shadow(0 4px 8px #000)` was an error in a `.tsx` style object and silent in a `.css` file, and `text-shadow: 0 0 rgb(0 0 0 / .5)` reported a _colour_ in CSS and a _shadow_ in JS, because the CSS colour pattern also matched the shadow properties and the two rules tested their branches in a different order.

Both rules now read the axis from one table in `value-patterns.mjs`, written once in the JS spelling with the CSS spelling derived from it. A property belongs to exactly one axis — building the lookups throws if one is listed twice — so the branch-order question disappears. A parity test walks the table and asserts both spellings resolve to the same axis, so a future divergence fails the suite.

Reconciling the divergences changes what both rules flag. No option schema changed, and no message text changed.

**CSS — new errors:**

- `filter` and `backdrop-filter` are now on the shadow axis, so `filter: drop-shadow(0 4px 8px #000)` is flagged (it always was in JS).
- `column-rule-color` is now flagged as a colour (it always was in JS).
- The two-segment logical border colours — `border-block-start-color`, `border-block-end-color`, `border-inline-start-color`, `border-inline-end-color` — are now flagged. The old regex allowed only one segment, so it caught `border-block-color` but not `border-block-start-color`.

**CSS — changed message id:** a `box-shadow` or `text-shadow` whose only literal is a colour, with no length to go with it (`text-shadow: 0 0 rgb(0 0 0 / .5)`), now reports `shadow` instead of `color`. Those properties are on the shadow axis and nowhere else; the advice to reach for a shadow token is the more actionable of the two. Values that already carried a length (`0 4px 12px rgba(0,0,0,.1)`) reported `shadow` before and still do. If you suppress this with an inline disable naming the message id, update it.

**JS/JSX — new errors:** the logical border colours (`borderBlockColor`, `borderInlineStartColor`, …) and logical radii (`borderStartStartRadius`, `borderStartEndRadius`, `borderEndStartRadius`, `borderEndEndRadius`) are now flagged. The CSS regex already covered most of these; the JS `Set` listed only the physical properties.

**JS/JSX — fewer errors:** `filter` and `backdropFilter` only count as a shadow when the value actually carries a `drop-shadow()`. `filter: 'blur(4px)'` was reported as a hardcoded shadow and told to use `shadow-md`, which is not the advice for a blur radius. `filter: 'drop-shadow(...) blur(2px)'` is still flagged.

**Both — fewer errors, in theory:** the CSS property patterns were regexes that also matched properties that do not exist (`border-anything-color`, `border-anything-radius`). The axis table lists the real properties instead. No valid stylesheet loses coverage.
