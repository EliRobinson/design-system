---
'@elirobinson/react': minor
---

`Switch` and `Checkbox` take a `hideLabel` prop. It keeps the label for screen readers and as the 44px hit area, and draws no text. Both now have a disabled look, including inside a disabled fieldset: `cursor: not-allowed` on the whole row and a muted label, plus a muted track and knob on `Switch`.
