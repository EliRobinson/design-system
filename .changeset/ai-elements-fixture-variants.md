---
'@elirobinson/ai-elements': minor
---

Add named variants beside the default fixtures: `variants` in `@elirobinson/ai-elements/fixtures`.

The accessibility audit wants exactly one mount per component — two of its four
checks are about a control's neighbours, so a gallery would measure the
harness's layout rather than the component. Documentation wants the opposite:
a tool pending, running, and errored are the states a reader is choosing
between when deciding whether to use it. `variants` is keyed by the
component's name in the manifest, then by a label naming the state, and sits
beside the existing one-mount-per-component `fixtures` rather than replacing
it. A component with nothing worth showing twice is simply absent from the
map.
