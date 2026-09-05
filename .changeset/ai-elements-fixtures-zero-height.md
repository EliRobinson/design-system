---
'@elirobinson/ai-elements': patch
---

Fix two more reference fixtures that mounted to zero height, in the same class as the three
already fixed.

Both rendered an empty box: the visual sweep reported a `1280x0` capture region for each,
and the accessibility sweep passed over them with nothing in the DOM to measure — the false
green `fixtures/index.tsx` warns about in its own header, where the "576 passed" is a test
count that does not move with what a fixture actually renders.

- `jsx-preview` mounted a bare `<JSXPreview jsx={…} />`. `JSXPreview` is only the context
  provider and a `relative` wrapper; the `jsx` string it is handed is never parsed until a
  `<JSXPreviewContent />` sits inside it. The fixture now composes the pair a consumer
  writes, `<JSXPreviewContent />` alongside the `<JSXPreviewError />` that surfaces a bad
  string.
- `panel` mounted a bare `<Panel>`. It wraps React Flow's own `Panel`, which is an overlay —
  `.react-flow__panel` is `position: absolute` in `@xyflow/react`'s stylesheet — so on its
  own it leaves the flow entirely and the page around it measures zero. It is now mounted
  inside a `Canvas`, which is the only way upstream documents it and matches how `controls`,
  `node` and `edge` are already mounted here.

`pnpm a11y:elements` passes 576 with both fixed, now over content that is actually rendered.
