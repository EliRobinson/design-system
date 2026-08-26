---
'@elirobinson/react': patch
---

`Select` no longer lets a long `<option>` scroll the whole page sideways in
WebKit — which in practice means on iPhones.

A native `<select>`'s preferred width is its widest `<option>`, and in WebKit
that width **escapes the control**: the `<select>`'s own box still obeys
`width: 100%` and the `<option>` boxes still measure `0 × 0`, yet
`documentElement.scrollWidth` grows and the document scrolls horizontally.
Chromium's UA stylesheet computes `overflow: clip` on a `<select>` and is
immune; WebKit computes `visible`.

```css
.ds-select {
  overflow: hidden;
}
```

Measured in a consuming app — `house-warm`, `/app/open-houses/new`, Playwright
Mobile Safari at 350 × 740, production build, one property whose address is 58
characters. The only variable between the two runs is whether the rule exists:

|                  | `documentElement`       | `<select>` | `overflow-x` |
| ---------------- | ----------------------- | ---------- | ------------ |
| without the rule | **439 / 350 — scrolls** | 310px      | `visible`    |
| with the rule    | 350 / 350               | 310px      | `hidden`     |

**The control is 310px wide in both runs.** `width: 100%` is being obeyed, the
class list is the shipped `ds-input ds-select` with no consumer width override
anywhere, and `.ds-field` is still `display: grid`. The leak is not downstream
of the control's used width, and anything that reads this rule as belt-and-braces
over that width has it wrong.

**The symptom does not appear where the cause is.** Once the document scrolls
sideways, any `position: sticky` header slides left with it — `sticky` pins
vertically but not horizontally — so the visible damage is a clipped header on
whatever screen the user happens to be on, which need not be the screen holding
the `Select` at all. It was originally filed as a billing-page bug with the
`Select` two routes away.

**Option text is user data** — addresses, names, email addresses — so no amount
of copy discipline downstream bounds the width, and no consumer can fix this
from their side except by overriding our stylesheet.

**Visually inert, verified rather than assumed.** The closed control renders
byte-identical PNGs with and without the declaration, in WebKit and Chromium,
light and dark, focused and unfocused. The focus ring is unaffected — `outline`
draws outside the border box and is not clipped by the element's own overflow.
The open menu is drawn by the OS outside CSS and is untouched; selecting the
long option still works and still returns its full value. The consumer measured
the same control width, 310px, either way.

**No `text-overflow: ellipsis` companion**, deliberately. It was measured: it is
a no-op in WebKit and _does_ change rendering in Chromium, so it would have this
release introduce a cross-engine divergence in the closed control's label while
removing one elsewhere. It is a design decision about how a truncated label
should read, and a bug-fix release is the wrong place to make it.

`Combobox` was checked and needs nothing: it renders `<input role="combobox">`
over a `<div role="listbox">` and has no `<option>` element anywhere, so the
mechanism cannot reach it. `Select` is the only component in the package that
renders a native `<select>`.

## The guard, and what it does not cover

`packages/react/scripts/select-intrinsic-width.test.mjs` launches **WebKit
specifically** and skips loudly when no browser is available. The engine is the
point: a Chromium project at a phone viewport passes green against this exact
defect, which is how it survived in a consuming repo that had a full e2e suite.

**It does not reproduce the bug in its reported shape, and that gap is
unexplained.** Serving the same markup and the same two stylesheets over a
routed origin measures 350 / 350 either way — as does every ancestor chain
tried, including the consumer's own grid-inside-flex-item-inside-column-flex
shell, which was the leading hypothesis and is disproven. Also ruled out:
viewport, device emulation, option length (57, 58 and 122 characters), and
engine build — Playwright's WebKit, macOS Safari 26.5.2 and iOS Safari 26.2 all
agree with each other and disagree with the consumer. The untested candidate,
left untested because this repo does not install Tailwind, is the consumer's
Tailwind v4 preflight and the cascade layers it puts ahead of the component
sheet.

So the guard pins a **proxy**: `width: 100%` is deliberately defeated, which does
make the fixture leak in WebKit, and the declaration must close it. It fails when
the declaration is removed, which is what earns it a place — but a green run
means "the declaration is present and still does what it does", not "the
reported bug cannot come back". The test header says so at length, so nobody has
to rediscover it. **If you are testing a `<select>` in this repo, this is the
blind spot to know about.**

## If you are upgrading `house-warm`

`house-warm` carries a local override of this exact rule in its `globals.css`
under `@layer components`, added as the workaround for design-system#173. It
becomes redundant **once this version is installed** — so remove it in the
**same change that bumps `@elirobinson/react`**, not before and not separately.
Removing it against an older version of this package puts the bug straight back
on every iPhone.
