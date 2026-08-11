---
'@elirobinson/eslint-config': minor
---

no-hardcoded-design-values: the JS/JSX and CSS rules now share one definition of what a hardcoded **value** is.

Both rules kept private copies of the same regexes and exemption list, and the copies had drifted — most visibly, `color(display-p3 1 0 0)` was an error in a `.tsx` style object and silent in a `.css` file. They now import a single `value-patterns.mjs`, and a parity test asserts value handling in both languages so a future divergence there fails the suite. (Which _property_ belongs to which axis is still decided per language and can still drift; that half is untouched.)

Reconciling the divergences changes which code the **CSS** rule flags. No option schema or message id changed, and the JS/JSX rule flags exactly what it flagged before.

- **New errors:** `color()` is now recognised as a colour function in CSS, so `color: color(display-p3 1 0 0)` is flagged (it always was in JS). If your stylesheets use wide-gamut literals, expect new errors — point `ignores` at the stylesheet that legitimately defines them, or move the literal into a custom property.
- **Fewer errors:** an explicit zero (`border-radius: 0px`) is no longer flagged in CSS — zero is not a design decision, and the JS rule never flagged it.
- **Fewer errors:** Tailwind's `theme(...)` now counts as a token reference in CSS as it already did in JS. Like `var(--…)`, it exempts the whole declaration it appears in, so `box-shadow: 0 1px 2px theme(--color-slate-200)` passes — and so does a compound value that mixes it with a literal, e.g. `transition: color 200ms theme(--ease)`.
- **No visible change:** `revert` is now exempt in JS as it already was in CSS, completing the four CSS-wide keywords. Nothing ever flagged it, so no consumer sees a difference.
