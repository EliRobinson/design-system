---
'@elirobinson/ai-patterns': patch
---

Stop the brand manifest scanners reading CSS comments as real dependencies.

`brand-manifest.mjs` scans raw stylesheet text for `@import` and `url()`, and
acted on both even inside a comment. That failed in two directions, and only
one of them was loud:

- prose naming a local file threw the dangling-`@import` error, during the
  `@elirobinson/ai-patterns` build, naming the `design-system-docs/` symlink
  rather than the `packages/tokens/src/` file the comment was written in;
- prose naming an `https://` host was recorded as a real `externalOrigins`
  entry with a green build — so a sentence explaining that the system no
  longer calls Google Fonts made the shipped manifest assert that it does,
  contradicting the guarantee `tokens.css` states in that very comment.

Comments are now masked once, ahead of both scans, so the two cannot drift.
The dangling-`@import` error itself is unchanged and still fires on a real
missing sibling — that check exists because the palette split once shipped a
greyscale brand skill, and softening it was never the fix.
