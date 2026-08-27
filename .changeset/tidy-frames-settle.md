---
'@elirobinson/ai-patterns': patch
---

Settle every frame before a visual capture, not just the main one

`waitForStablePixels` waited on `document.images` and `document.fonts.ready`
through `page.*`, which reach the main frame only. A page that embeds its
content in iframes was therefore captured with its embedded documents
unawaited: `/brand/guidelines` carries 23 frames with 253 font faces of their
own against the parent's 15, and a frame webfont applying after the page had
been called stable repainted text inside a box whose height is pinned inline —
a diff with no layout change that landed in one of two stable end states, so
regenerating its baseline never converged.

The settle now runs per frame, promotes `loading="lazy"` frames to eager so a
deferred one has started before anything waits on it, and waits for embedded
documents to finish parsing. A frame that detaches mid-wait is skipped rather
than failing the sweep.
