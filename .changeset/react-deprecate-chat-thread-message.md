---
'@elirobinson/react': minor
---

Deprecate `ChatThread` and `ChatMessage` in favour of `@elirobinson/ai-elements`.

`Conversation` is backed by `use-stick-to-bottom`, which already implements the
follow-only-a-reader-at-the-bottom behaviour `ChatThread` was written for; its
smooth-scroll default was the real gap and the transform layer now pins it to
instant. `Message` takes a `UIMessage` role, renders markdown, and carries
branch navigation.

`ChatThread`'s `announce` prop has no direct equivalent. `Conversation` spreads
props last over its `role="log"`, so write `aria-live` and `aria-relevant`
directly.

`StreamingCaret` is **not** deprecated. `Shimmer` animates a gradient across a
string; a caret marks the insertion point in text that is still arriving.

Both components still work. They are removed on the next major.
