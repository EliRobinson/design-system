---
'@elirobinson/ai-patterns': minor
---

The brand voice is a pack, and every surface that shows it is generated from that one file.

The use/avoid word lists were hand-kept in two places that had already diverged, and the
divergence ran the wrong way: `README.md` (19 use / 15 avoid) reaches agents through
`/llms-full.txt`, while `guidelines/brand-voice.html` (8 / 7) is the page a person opens. A
third copy in `apps/docs` was removed by #136. A fourth fact, `contracts.json`'s
`systemPromptStyle.voice`, flattened the four-step tone ranking to three adjectives.

All of them now derive from `design-system-docs/miltinson.voice.json`.
`packages/ai-patterns/scripts/sync-voice.mjs --check` fails the build when one drifts, and CI
runs it. The pack itself now ships inside the brand skill alongside the surfaces generated
from it.

The pack carries two fields neither `README.md` nor `brand-voice.html` needed before, because
deriving them from `label` alone would have silently dropped text a rendered page already
shipped with: `fullName` (`"Miltinson Technologies"`, the legal name — `label` is the short
mark) for the voice card's subtitle, and `person.summary` for the lead paragraph the
hand-kept card opened with.

The move is deliberately a re-hosting and not a rewrite: a test asserts the rendered
`## CONTENT FUNDAMENTALS` section is byte-identical to the one that shipped before, so
`/llms-full.txt` and the packed skill are unchanged by this release.
