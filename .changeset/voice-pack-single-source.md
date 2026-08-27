---
'@elirobinson/ai-patterns': minor
---

The brand voice is a pack, and the four surfaces that state it are generated from that one file.

The use/avoid word lists were hand-kept in two places that had already diverged, and the
divergence ran the wrong way: `README.md` (19 use / 15 avoid) reaches agents through
`/llms-full.txt`, while `guidelines/brand-voice.html` (8 / 7) is the page a person opens. A
third copy in `apps/docs` was removed by #136. A fourth fact, `contracts.json`'s
`systemPromptStyle.voice`, flattened the four-step tone ranking to three adjectives. A fifth,
the "Key brand reminders" list in `design-system-docs/SKILL.md`, had rotted further still —
`Tone: practical, honest, warm, no-fluff` drops "Quietly confident" and promotes a
`words.use` entry into the ranking — and it shipped verbatim to consumers as the first thing
an agent invoking the brand skill reads.

Four surfaces now derive from `design-system-docs/miltinson.voice.json`, each written whole
by `packages/ai-patterns/scripts/sync-voice.mjs`:

- `design-system-docs/README.md` — the `## CONTENT FUNDAMENTALS` section, which is what
  `/llms-full.txt` carries
- `design-system-docs/SKILL.md` — the voice, tone and emoji bullets of "Key brand reminders"
- `design-system-docs/guidelines/brand-voice.html` — the whole card
- `packages/ai-patterns/src/contracts.json` — `systemPromptStyle.voice`

`sync-voice.mjs --check` fails the build when one drifts, and CI runs it un-cached. The pack
itself ships inside the brand skill alongside the surfaces generated from it.

**What is still hand-authored, and therefore can still drift.** The rest of `SKILL.md`'s
reminders sit outside the generated block because they are not voice-pack data and the
schema is not being widened to swallow them: colour, type, radii and the accessibility
floors; the wordmark line, which states the mark's period _and_ its colour; the two taglines,
because the pack's `taglines` are candidate lines written in the brand's style and nothing in
the schema designates a primary; and the Kids Recipes emoji exception, which the pack's
`emoji` section has no field for. Those lines are hand-kept prose today.

The pack carries two fields neither `README.md` nor `brand-voice.html` needed before, because
deriving them from `label` alone would have silently dropped text a rendered page already
shipped with: `fullName` (`"Miltinson Technologies"`, the legal name — `label` is the short
mark) for the voice card's subtitle, and `person.summary` for the lead paragraph the
hand-kept card opened with.

The README section is deliberately a re-hosting and not a rewrite: a test asserts the
rendered `## CONTENT FUNDAMENTALS` is byte-identical to the one that shipped before, so
`/llms-full.txt` is unchanged by this release. The packed `SKILL.md` **does** change, and has
to: the bytes it shipped were wrong.
