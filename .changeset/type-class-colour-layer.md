---
'@elirobinson/tokens': minor
---

A Tailwind text colour utility on a `.t-*` element now takes effect (#251).

**The bug.** Every `.t-*` type class except `.t-code` set `color` in an unlayered rule. An
unlayered rule beats every cascade layer, and Tailwind puts all of its utilities in
`@layer utilities`. So `<p class="t-caption text-destructive-ink">` rendered the caption's grey,
and the only way to get the colour back was `!` on the utility. This is the bug #112 fixed for
the bare `a` rule.

**The fix.** The `color` of each `.t-*` class moved into `@layer base`, beside the `a` rule. Only
the colour moved. The family, size, weight, leading and tracking of each class stay unlayered.

**What you see.** A `.t-*` element renders as before unless something else in your CSS sets its
colour. A colour utility on the same element now wins. So does any other colour rule that states
an intent, which is a change if you relied on the type class beating it:

- an unlayered rule of yours with lower specificity, such as `h2 { color: … }` or a `:where()`
  selector, on an element that also carries `.t-h2`;
- an unlayered rule of equal specificity that used to lose on source order, such as a class rule
  in a stylesheet loaded before a second import of `tokens.css`;
- a colour rule in any layer above `base`, such as `@tailwindcss/typography`'s `.prose` styles.

An `<a>` with a type class keeps the type colour at rest and now takes `--link-hover` on hover.

**What does not change.** A colour on a parent still does not reach a `.t-*` child. A declared
colour beats an inherited one in any layer, so put the utility on the type-class element itself.

**What to do.** If you added `!` to colour utilities on `.t-*` elements to work around this, such
as `!text-destructive-ink` on a `t-caption`, you can remove the `!`. Then check the three cases
above in your visual diffs.
