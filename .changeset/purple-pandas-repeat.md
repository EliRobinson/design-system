---
'@elirobinson/tokens': patch
'@elirobinson/react': patch
---

tokens.css: load the webfonts before anything else, and let a utility class colour a link

Two fixes to the same stylesheet.

**The `fonts.css` import is now first (#76).** It sat after `palettes.css` and
`mobile.css`, which is valid in a standalone file because the three are adjacent
— but every bundler inlines an `@import` in place, so once those two were
substituted in, real rules preceded the fonts import and the parser discarded
it. `next build` warned once and shipped a stylesheet with zero `@font-face`
rules; `next dev` returned a 500. Hoisting it fixes both, and moves no
declaration relative to any other, because `fonts.css` contains nothing but
`@font-face`.

`@elirobinson/tokens/fonts.css` is also exported now, alongside the
`palettes.css` and `mobile.css` subpaths that were already there. Purely
additive.

**The bare `a` rule moved into `@layer base` (#112).** Unlayered, it outranked
every Tailwind utility — all of which live in `@layer utilities` — so
`text-accent-foreground`, `text-muted-foreground` and every other `text-*` on an
anchor silently did nothing, and a teal CTA that had asked in markup for the
palette's own `--accent-fg` shipped white-on-`#14b8a6` at ~2.1:1. It was not
fixable from a consumer stylesheet either: an unlayered override of theirs beats
the utilities too.

In a layer the rule still does its one job — an anchor nobody has styled is
coloured and underlined — and now loses to anything that states an intent. No
token value changed, and nothing in `:root` is layered, so the documented
`--ds-font-*-override` hook and every other token override behave exactly as
before.
