---
'@elirobinson/tokens': minor
'@elirobinson/ai-patterns': patch
---

Tailwind utilities on a `.t-*` element now take effect (#251).

**The bug.** Every `.t-*` type class was an unlayered rule. An unlayered rule beats every cascade
layer, and Tailwind puts all of its utilities in `@layer utilities`. So on a type-class element,
`text-destructive-ink`, `font-mono`, `text-sm`, `font-semibold`, `tracking-wide` and
`normal-case` did nothing unless they carried `!`. This is the bug #112 fixed for the bare `a`
rule.

**The fix.** The whole of each `.t-*` rule moved into `@layer base`, beside the `a` rule:
colour, family, size, weight, line height, letter spacing, text transform, and `.t-code`'s
background, border, radius and padding.

**What you see.** A `.t-*` element renders as before unless something else in your CSS sets one of
those properties on it. A utility on the same element now wins. So does any other rule that
states an intent, which is a change if you relied on the type class beating it:

- an unlayered rule of yours with lower specificity, such as `h2 { font-size: … }`,
  `h2 { color: … }` or a `:where()` selector, on an element that also carries `.t-h2`;
- an unlayered rule of equal specificity that used to lose on source order, such as a class rule
  in a stylesheet loaded before a second import of `tokens.css`;
- a rule in any layer above `base`, such as `@tailwindcss/typography`'s `.prose` styles.

Tailwind's preflight is in `base` too, and its element resets (`h1 { font-size: inherit }`,
`code { font-size: 1em }`) are less specific than a `.t-*` class, so they still lose to it.

An `<a>` with a type class keeps the type colour at rest and now takes `--link-hover` on hover.

**What does not change.** A colour or font on a parent still does not reach a `.t-*` child. A
declared value beats an inherited one in any layer, so put the utility on the type-class element
itself.

**What to do.** If you added `!` to utilities on `.t-*` elements to work around this, such as
`!text-destructive-ink` on a `t-caption` or `!font-mono` on a `t-body`, you can remove the `!`.
Then check the three cases above in your visual diffs.

**`ds classes` and `ds list`** in `@elirobinson/ai-patterns` now find a class that opens a rule
at any indent. Without this they listed no `.t-*` classes from this `tokens.css`, because the
classes are now indented inside `@layer base`. An older `ai-patterns` paired with this `tokens`
leaves them out of its typography list; update both.
