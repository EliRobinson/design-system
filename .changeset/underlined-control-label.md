---
'@elirobinson/eslint-config': minor
'@elirobinson/ai-patterns': minor
---

A control no longer gets to dress up as a link. `@elirobinson/eslint-config/css` gains
`no-underlined-control-label`: a rule that paints a control's own filled surface and also
declares `text-decoration: underline` is an error, because an underline is the one visual
signal a hyperlink owns and a reader cannot tell a button wearing it from a link. A
link-styled button on no fill, and a link that happens to sit on a fill, are both
deliberate patterns and stay silent.

The matching `componentConstraints` entry ships in `@elirobinson/ai-patterns`' contracts,
with its `verifiedBy` naming the lint rule and the two `@elirobinson/react` tests that pin
the same property inside the system.

No token values changed, and no component changed: `.ds-button` already dropped the
underline in every variant. This is the guard that keeps it that way.
