---
'@elirobinson/ai-elements': patch
---

Fix three reference fixtures that rendered an empty box.

`fixtures/index.tsx` says in its own header that a fixture rendering no
controls is how an audit ends up green without having looked at anything.
Three of them were doing exactly that, and it only surfaced when the
documentation site started mounting them where a person could see them:

- `confirmation` passed no `approval`, and `<Confirmation>` returns `null`
  without one — so nothing rendered at all.
- `attachments` mounted the default `grid` variant with no `AttachmentPreview`
  and no `AttachmentInfo`, and an `<AttachmentRemove>` that returns `null`
  without an `onRemove` — a 96px tile with nothing in it. It is now the `list`
  variant, fully composed, which is also the variant whose remove button is
  visible rather than revealed on hover.
- `plan` nested `PlanTitle` inside `PlanTrigger`, which spreads its props into
  a `<Button>` that already has JSX children — so the title was silently
  dropped. `PlanTitle` is now a sibling, with the trigger in a `PlanAction`.

`pnpm a11y:elements` passes 576 with all three fixed, now over controls that
are actually in the DOM.

`variants` also gains a `Closed` mount for `context`, `inline-citation` and
`model-selector`. Their default mounts are open, which is right for the audit —
each has a page to itself — but a Radix dialog or hover card renders into a
portal on `document.body`, so an open-by-default one inside a documentation
page lands on top of the page instead of inside the demo. The default mounts
are unchanged.
