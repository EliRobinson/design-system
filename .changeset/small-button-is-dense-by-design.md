---
'@elirobinson/ai-patterns': patch
---

`checkTouchTargets()` recognises `.ds-button--sm` as a compact variant.

`.ds-button--sm` is 36px and `MINIMUM_TOUCH_TARGET` is 44, so the system's own
small button failed the system's own `expectDesignSystemContracts()`. Neither
remediation the error offered was correct: padding it to 44px turns an `sm` into
an `md`, and hand-adding `data-touch-target="dense"` to a header CTA teaches
consumers that the contract is something you silence. `sm` stays 36px and the
contract now recognises it.

Why the button rather than the contract moved:

- WCAG 2.2 **AA** (SC 2.5.8, Target Size Minimum) asks for 24x24 CSS px. 44x44
  is **AAA** (SC 2.5.5). 36px clears AA with margin — it is under this system's
  stricter default, not under the standard. shadcn's own `sm` button is 36px.
- Raised to 44px, `sm` would differ from `md` only in font size and horizontal
  padding — a typography variant, not a size variant. That deletes the reason
  `sm` exists, and anyone needing a compact control hand-rolls one outside the
  system instead.
- The two-tier contract (`touch-target-primary` / `touch-target-dense`) was not
  wrong. The gap was that `size="sm"` had no way to declare which tier it is in.

`.ds-button--sm` joins `DENSE_AFFORDANCE_SELECTOR`, so the exemption is keyed
off the **class, not a React prop**. The failure reported in the wild was
`a.ds-button.ds-button--accent.ds-button--sm` — an anchor carrying the classes,
which `tokens.css` explicitly supports — so anything `Button.tsx` emitted for
`size="sm"` would have missed it. Both `<Button size="sm">` and a hand-written
`<a class="ds-button ds-button--sm">` now pass, and both are asserted against
the shipped `Button.css` rather than a restated fixture.

Nothing renders differently: 36px is still 36px, and no component or stylesheet
changed. What changed is the contract, `contracts.json`'s `touch-target-primary`
and `touch-target-dense` wording, and the violation message, which no longer
points a consumer at `data-touch-target="dense"` as the only escape.

The trade-off, recorded rather than solved: a consumer who uses `size="sm"` for
a page's primary mobile action now gets a silent pass. Holding compact controls
to a _dense floor_ (WCAG's 24x24) instead of exempting them from measurement is
the answer to that, and is deliberately not built here.
