---
'@elirobinson/tokens': patch
---

`tailwind.css`'s banner names the system rather than one consumer.

#213 fixed this exact banner in `tokens.css`, `palettes.css` and `mobile.css` and did not
look at the fourth stylesheet, because the manual sweep that preceded the test was done by
eye. The system's own name is Miltinson Design System; the banner asserted a different one.

The file is published — `files` includes `src` — so this is shipped text, not an internal
comment. `brand-boundary.test.mjs` does not yet reach it: the test scans built artifacts
and the agent templates, and #214 tracks widening that scan to the rest of published
`src/**` so the docblock's claim and the check underneath it agree.
