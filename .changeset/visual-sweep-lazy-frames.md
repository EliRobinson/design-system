---
'@elirobinson/ai-patterns': patch
---

`waitForStablePixels` waits for lazy iframes and their contents, not just the parent document.

`loading="lazy"` defers a frame until it nears the viewport, so whether a given frame has
loaded when the screenshot is taken is a race against how far the capture has scrolled and
how fast the machine is. None of the existing guards could see it: `document.images` is the
parent's collection and does not include frames, `document.fonts.ready` is the parent's
font set, and a frame that is blank in two consecutive captures reads as stable to the
settle loop.

Measured on `/brand/guidelines`, which embeds 23 guideline cards this way — 11 of 23 loaded
locally and the rest never did, while CI landed on a different split per run. The visible
symptom was one card's worth of pixels, about 0.01 of the image, alternating between the
light and dark shots with nothing else changing.

Every lazy frame is now flipped eager and waited on individually. Same-origin frames only:
a cross-origin frame cannot be inspected, so it is skipped rather than waited on forever.
