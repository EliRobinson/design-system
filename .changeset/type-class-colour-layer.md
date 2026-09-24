---
'@elirobinson/tokens': patch
---

A Tailwind text colour utility on a `.t-*` element now takes effect (#251).

**The bug.** Every `.t-*` type class except `.t-code` set `color` in an unlayered rule. An
unlayered rule beats every cascade layer whatever the specificity, and Tailwind puts all of its
utilities in `@layer utilities`. So `<p class="t-caption text-destructive-ink">` rendered the
caption's `--fg-3` grey, and the only way to get the colour back was `!` on the utility. This is
the bug #112 fixed for the bare `a` rule.

**The fix.** The `color` of each `.t-*` class moved into `@layer base`, beside the `a` rule. Only
the colour moved. The family, size, weight, leading and tracking of each class stay unlayered.

**What you see.** A `.t-*` element with no colour of its own renders exactly as before, in every
palette and theme. A colour utility on the same element now wins. One thing changes that is not a
fix: an `<a>` carrying a type class still takes the type colour at rest, but on hover it now
takes `--link-hover`, because `a:hover` shares the layer and has higher specificity.

**What does not change.** A colour on a parent still does not reach a `.t-*` child. A declared
colour beats an inherited one in any layer, so put the utility on the type-class element itself.

**What to do.** If you added `!` to colour utilities on `.t-*` elements to work around this, such
as `!text-destructive-ink` on a `t-caption`, you can remove the `!`. An unlayered rule of your own
that sets `color` on a `.t-*` element also still wins, as before.
