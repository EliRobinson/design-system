---
'@elirobinson/react': patch
---

Fix `Dialog` and `CommandPalette` rendering in the top-left corner under a CSS reset.

`.ds-dialog` set width, max-width, max-height and padding but no `margin`, so its centring
came from the UA stylesheet's `dialog { margin: auto }`. A reset's universal `margin: 0` is
an _author_ rule, and author styles beat the UA at any specificity — so in any app shipping
one, the margin collapsed and `position: absolute; inset: 0` pinned the dialog to the
top-left. Tailwind v4's preflight does this; so do normalize-ish resets, sanitize.css, and
most hand-rolled ones. Reported against Next.js 15 + Tailwind v4 on `@elirobinson/react@2.0.1`.

`.ds-dialog` now declares `margin: auto` itself, which outranks `*` and is immune to the
reset. `CommandPalette` renders through `DialogContent` and so is fixed by the same rule —
it needs no change of its own, and gained none.

**No action needed on upgrade.** Nothing in your app changes; if you had worked around this
with a local override such as:

```css
.ds-dialog {
  margin: auto;
}
```

that override is now redundant and can be deleted.
