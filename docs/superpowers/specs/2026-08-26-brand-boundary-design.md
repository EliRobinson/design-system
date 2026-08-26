# Design: give prose the dial that colour already has, and make the brand boundary mechanical

**Date:** 2026-08-26
**Closes:** [#145](https://github.com/EliRobinson/design-system/issues/145), [#142](https://github.com/EliRobinson/design-system/issues/142), [#159](https://github.com/EliRobinson/design-system/issues/159)
**Touches:** `packages/ai-patterns/src/voice/` (new), `packages/ai-patterns/src/artifacts/llms.mjs`, `packages/ai-patterns/src/contracts.json`, `packages/ai-patterns/src/cli/`, `packages/design-system-mcp/src/server.mjs`, `design-system-docs/`, `apps/docs/src/app/(docs)/guidelines/voice/page.mdx`, `docs/agents/brand-boundary.md` (new), `docs/agents/product-token-layer.md`, `AGENTS.md`
**Does not touch:** `packages/react`, `packages/eslint-config`, `packages/tokens/src/palettes.css`, `packages/tokens/src/fonts.css`, the system's name, `ds init --agents` templates

## Problem

The colour layer finished the transition from one site's rules to a published system. The
prose layer never started it.

`palettes.css` was split out of `tokens.css` precisely because `tokens.css` "used to
hardcode one brand", and Miltinson's own colours were **contributed as a named palette**
rather than left as the system's definition of correct. Miltinson Amber stayed the
default and stopped being a rule, in the same move, because `data-palette` made "default"
a word that means something.

Prose got neither half of that. `design-system-docs/README.md` still ships whole to every
consumer's agent — one company's price format, wordmark punctuation, product line and
sample copy, framed by `llms.mjs:318` as `## Brand … these rules make it Miltinson`.

**The contradiction is internal, and it is enforced in code on one side only.**
`packages/ai-patterns/src/patterns.md:84` ships this to consumers:

> **What this rule does not touch: a product's editorial voice.** Marketing prose,
> conversational surfaces, and written deliverables are the product, and their voice is a
> deliberate design decision — this rule has nothing to say about them.

`packages/eslint-config/src/index.test.mjs:559` asserts it with a
`describe('content: everything that is not chrome')` block. So the lint rule declines to
police a product's editorial voice, while the brand skill ships one.

### The published brand guidance is stale against its own source

Verified against the live site, not inferred from the repo: `https://www.miltinsons.com/`
serves `data-palette="miltinson"` on the root element. `palettes.css:456` describes that
palette as teal over indigo. `design-system-docs/README.md:123-124` — shipped verbatim to
every consumer — names "Miltinson Amber" the only loud colour and "Miltinson Forest" the
secondary anchor, and ties Forest to the Coaching Guides sub-brand.

The document shipped as "the brand" describes a brand its own source stopped rendering,
and nothing anywhere failed. That is the failure mode this design exists to close: silent
by construction, because no consumer files a bug against a design system for shipping
plausible copy in the wrong voice.

### The word lists: #142's count is stale, and the remaining divergence is worse than it looks

#142 was filed at 09:12 UTC on 2026-08-26 and measured three copies. #136 merged at 19:18
UTC the same day and removed one of them. Re-measured on `1e98ec9`:

| copy                                                                | reaches                                               | use      | avoid                       |
| ------------------------------------------------------------------- | ----------------------------------------------------- | -------- | --------------------------- |
| `design-system-docs/README.md:89,93`                                | **agents**, via `/llms-full.txt` and the packed skill | 19       | 15                          |
| `design-system-docs/guidelines/brand-voice.html`                    | **humans**, live on `/brand/guidelines`               | **8**    | **7**                       |
| `apps/docs/.../guidelines/voice/page.mdx`                           | —                                                     | **gone** | **gone**                    |
| `packages/ai-patterns/src/contracts.json` `systemPromptStyle.voice` | agents, shipped                                       | —        | `"practical, honest, warm"` |

Two live copies of the word lists, not three. #142's other numbers have also moved: it
measured README at 19/16 and `brand-voice.html` at 8/8, and the avoid lists have since lost
`"we" (when Eli means "I")` to #136's retirement of the royal-we rule. **#142's body needs
re-measuring before it is worked, not just re-homing.**

The finding that survives intact is #142's sharpest one, and it is unchanged:

> The most complete copy is the one no human reads, and the least complete is the one every
> human reads.

`brand-voice.html` still ships less than half the avoid list — no `robust`, `world-class`,
`frictionless`, `cutting-edge`, `reimagine`, `ninja`, `rockstar` — to the page a person
actually opens.

`contracts.json` is a fourth hand-kept copy of a different fact: it flattens the settled
four-step tone ranking to three adjectives and drops "quietly confident" entirely.

Hand-kept copies of an enumeration are not a documentation problem. They are a missing
generator.

### What the audit got right, and one thing it has since outgrown

The audit in #145 is accurate at source on every point this design depends on:
`BRAND_SOURCES` shipping `ui_kits/` whole, the `./brand-readme` export,
`get_brand_guidance`'s "makes a page Miltinson rather than merely correct",
`invoice.html:39`'s real postal address, `Primitives.jsx:19`'s `oklch(72.5% 0.175 65)`
literal.

One part is stale: #136 merged after the audit was written, so
`design-system-docs/SKILL.md:25` now reads "The voice is Miltinson Technologies; 'I' or
'we' is the product's call, held consistently within a surface", and `README.md:67`'s
"never the royal 'we'" is gone — along with the five tests across three packages that
asserted it, which now survive only in two CHANGELOG entries. The frontmatter description
and the other eight reminders are unchanged, so A3 stands otherwise.

## The boundary rule

The rule proposed in #145 — _if a second consumer would have to delete it to be correct,
it is the consumer's_ — settles seven of its nine test rows and openly fails on D1
(`[data-palette='miltinson']`, where there is nothing to delete) and D2 (the gradient
ban).

The rule this design adopts settles all nine:

> **The system ships what is inert until chosen, or true under every brand. The consumer
> holds anything an agent applies by default with no dial to turn.**
>
> Where a constraint is arguable: it stays in the system only if it can be justified
> without naming a brand's character — and then it must be _written_ that way.

| finding                                              | verdict              | why                                                                      |
| ---------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `[data-palette='miltinson']`                         | system               | inert until selected, and contrast-gated. So is `slate`.                 |
| `[data-palette='slate']`                             | system               | same test, same answer — which is the point                              |
| Miltinson Amber as default                           | system               | a default is a value in a slot with a documented dial                    |
| Geist / JetBrains Mono                               | system               | `--ds-font-*-override` is the dial, enforced by `font-override.test.mjs` |
| 44×44, focus rings, WCAG AA                          | system               | true under every brand                                                   |
| "no left-border accent stripe"                       | system               | craft warrant ("clichéd AI-slop pattern"), no brand named                |
| "no gradients — the brand is honest, not theatrical" | consumer, or rewrite | character warrant. Keep the constraint only with a craft warrant.        |
| the voice rules, as shipped today                    | consumer             | applied by default, no dial                                              |
| the voice rules, as a named pack                     | system default       | inert in the sense that matters: replaceable, and labelled               |

The last two rows are the whole design. **The same 51 lines are a boundary violation
framed as `## Brand — these rules make it Miltinson`, and are not one framed as
`## Voice (pack: miltinson — default)`.** Fencing removes them; labelling fixes them.
Labelling is what `palettes.css` did, and it is why nobody thinks the amber default is a
problem.

This also disposes of #145's recorded counter-argument rather than accepting its cost.
The objection is that the brand content is the most useful thing in the tarball and an
empty schema is a regression. Under this design nothing is ever removed, so there is no
regression window and `get_brand_guidance` never returns an empty schema.

## The product voice layer

Structurally a mirror of `docs/agents/product-token-layer.md`, which already solved this
for tokens: the system declares the slots and their fallbacks, the consumer declares the
values, adopting it is not a fork, and a test fails the build when the shape breaks.

| the system ships                                                                                                     | the consumer holds                      |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `packages/ai-patterns/src/voice/schema.mjs` — the section list, and which sections are system-level vs product-level | `<repo-root>/voice.json` — their values |
| `packages/ai-patterns/src/voice/render.mjs` — pack → the markdown `brandVoice()` returns today                       |                                         |
| `packages/ai-patterns/src/voice/starter.voice.json` — the schema restated with system defaults and nothing else      |                                         |
| `packages/ai-patterns/src/voice/resolve.mjs` — consumer pack → built-in default                                      |                                         |
| `design-system-docs/miltinson.voice.json` — the built-in pack, shipped as the default                                |                                         |

The Miltinson values live in the brand source directory, not in a package — the same
placement rule as `product-token-layer.md:149`, "a product's palette lives in the
product". `packages/` holds schema, renderer and resolution; `design-system-docs/` holds
one pack that happens to be the default.

### Pack shape

Structured data with prose fields. Enumerations are arrays; editorial guidance is prose
strings. Only data can feed several surfaces without one hand-kept copy per surface.

```jsonc
{
  "id": "miltinson",
  "label": "Miltinson Technologies",
  "person": { "guidance": "…", "anchors": { "asPerson": "…", "asCompany": "…" } },
  "tone": [
    { "name": "Practical", "gloss": "no-fluff, what's actually useful" },
    { "name": "Honest", "gloss": "calls out hype, transparent pricing" },
    { "name": "Warm", "gloss": "patient, reassuring about non-technical readers" },
    { "name": "Quietly confident", "gloss": "never flexes credentials" },
  ],
  "casing": ["…"],
  "words": { "use": ["…"], "avoid": ["…"] },
  "emoji": { "guidance": "…", "allowed": ["✓"] },
  "anchors": ["…"],
  "taglines": ["…"],
}
```

The tone ranking is settled and ordered — Practical / Honest / Warm / Quietly confident —
so `tone` is an ordered array and the renderer numbers it. That is what lets it "do more
work than it currently does": once it is data, a surface can render the weighting rather
than restate the four adjectives.

`schema.mjs` marks each section `system` or `product`. Today every section is `product`.
The distinction exists because #159 needs it — it is what marks the seam — and because a
future system-level writing rule (the `patterns.md` chrome rules are already one) needs
somewhere to live that a consumer pack cannot overwrite.

### Reversing half of `guideline-cards.mjs`

`guideline-cards.mjs:9-11` states the opposite position:

> Only the enumerations live here. Cards that carry editorial judgement — brand voice, the
> wordmark rules, type specimens, "spacing in use" — are writing, not data, and are
> mirrored from the design project instead.

That docblock's own criterion is what justifies the change, and the drift measured above
is the evidence: **the word lists are enumerations wearing prose clothing, and that is
exactly why they diverged.** The prose around them stays writing. The docblock is amended
to say so rather than left contradicting the new generator.

### Discovery

`ds init --voice` scaffolds `voice.json` at the consumer's repo root from
`starter.voice.json`. **The file's presence is the declaration** — no config key, no
package.json field. This matches how `ds` already works ("read from node_modules at run
time … discovered rather than assumed", `commands.mjs:72-75`) and mirrors
`tokens.product-layer.css`, which is a starter file a consumer copies rather than a
setting a consumer sets.

Resolution: consumer pack → built-in `miltinson` pack. **Never an error, never an empty
schema** (#145 open question 2).

## Data flow

```
design-system-docs/miltinson.voice.json      ← the only hand-kept copy
  │
  └─ render.mjs
       ├─ brandVoice()               → llms-full.txt  "## Voice (pack: miltinson — default)"
       ├─ get_brand_guidance         → consumer pack if resolved, else this, labelled
       ├─ miltinson://brand/voice    → same
       ├─ ds voice                   → new CLI command
       ├─ README.md ## CONTENT FUNDAMENTALS       (new managed block)
       ├─ guidelines/brand-voice.html             (generated card)
       └─ contracts.json systemPromptStyle.voice  (derived at build, not typed twice)
```

`apps/docs`' voice page is **not** on that list, and deliberately. #136 already rewrote it to
carry only the system-level chrome rule and to link the brand half rather than copy it:

> It is not reproduced here: it is brand-specific rather than system-wide, and a second copy
> on this page would be a second copy to keep in step.

The only change it needs is re-pointing that link from `design-system-docs/README.md` to the
active pack. That is one paragraph, not a generator.

Note `README.md`'s existing `ds-artifacts:managed` markers sit at lines 29-57 and wrap the
INDEX table only. `## CONTENT FUNDAMENTALS` at line 61 is outside them and hand-authored,
so this needs a **second** managed block, not an extension of the first.

## Error handling

- **No consumer pack** — resolve to the built-in default. Not an error. The label in every
  rendered output names which pack is active, so "you are reading someone else's voice" is
  visible rather than inferred.
- **Malformed consumer pack** — fail loudly with the failing field path, and do not fall
  back. A consumer who wrote a pack and got Miltinson's voice silently is the exact defect
  this design closes; falling back would reintroduce it one layer down.
- **Missing required section** — `render.mjs` throws naming the section, in the shape
  `brandVoice()` already throws when `## CONTENT FUNDAMENTALS` is absent (`llms.mjs:92`).
- **Unknown extra fields** — ignored, not rejected, so a consumer on an older schema is not
  broken by a pack written against a newer one.

## Testing

### `packages/ai-patterns/src/artifacts/brand-boundary.test.mjs`

Double-entry, in the shape of `packages/react/scripts/product-layer.test.mjs`:

1. **No published artifact contains a brand term outside a permitted file.** Walks the
   built `dist/artifacts/**`, every exports-map target, `llms.txt`, `llms-full.txt` and
   the `ds init --agents` templates.
2. **The permitted-file set is exactly the set `docs/agents/brand-boundary.md` names.**
   Neither side moves without the other.

Two carve-outs in the denylist, both from recorded decisions: `Miltinson Design System`
(the system's name, kept) and `miltinson` as a palette or pack identifier (kept). Matching
is therefore term-plus-context, not a bare substring. Everything else — `Eli Robinson`,
`miltinsons.com`, `Kids Recipes`, `Coaching Guides`, `From $150/hr` — fails the build
outside a pack or fixture file.

This test is the deliverable that makes the rest stick. `product-layer.test.mjs` is why
the token layer has not drifted; without its equivalent, PRs 1-4 are a tidy-up that the
next well-meant edit undoes.

### Other coverage

- **Round-trip** — `render(parse(pack))` reproduces the shipped `## CONTENT FUNDAMENTALS`
  section byte-for-byte at the point of conversion, so PR 2 is provably a re-hosting and
  not a rewrite.
- **Resolution** — consumer pack present / absent / malformed, three cases.
- **Colour literals in `ui_kits/**`** — a targeted test, because `eslint.config.mjs:21`ignores`design-system-docs/\*\*`wholesale and that is precisely why`Primitives.jsx:19` survived. Un-ignoring would cascade across 13 static JSX files with
  no build step, so the guard is a test rather than lint coverage.

## Recorded answers to #145's open questions

1. **Does `[data-palette='miltinson']` stay?** Yes. Inert until selected and contrast-gated,
   so it is the system's under the rule above. `product-token-layer.md:149` is amended to
   say why a palette differs from a product value. Not renamed:
   `https://www.miltinsons.com/` serves the attribute in production today, so a rename is a
   live migration for no gain.
2. **What does `get_brand_guidance` return with no declared voice?** The built-in pack,
   labelled as the default, with a pointer to `ds init --voice`. Never an error.
3. **Do the UI kits ship?** Yes, all four. The 44 Miltinson strings across 13 files move
   into one `_shared/content.js` fixture the kits import. Reskinning becomes a one-file job
   and the boundary test gets a single file to permit.
4. **Is "Miltinson Design System" still the name?** Yes. The rename is expensive and the
   ambiguity `llms.mjs:319` creates dissolves once the claim it collides with is gone.
5. **Where do Geist and JetBrains Mono sit?** Unchanged in `@elirobinson/tokens`.
   `tokens.css:270` already reads `var(--ds-font-sans-override, …)` and
   `font-override.test.mjs` already enforces the cascade that makes the hook work. Same
   shape as the amber default: a value in a slot with a tested dial.
6. **Does #142 wait?** No — it becomes PR 2, consolidating directly into the pack so the
   result never moves twice. Its body is measurably stale post-#136 (two live copies, not
   three; different counts) and PR 2 should open by re-measuring and correcting it, so the
   issue is not closed against numbers that were never true of the code it closes.

**#159 is half-done already, and this design finishes it.** It was filed at 16:53 UTC on
2026-08-26; #136 merged at 19:18 UTC the same day. Its body quotes an opening line
("Miltinson copy sounds like one person who builds things…") that no longer exists, and the
interleaving it tabulates is gone — the current page opens with the chrome/content
distinction, keeps only the system-level half, and links the brand half. **#136 implemented
the docs-side half of #159's reading A.** What is left of #159 is the half reading A said it
could not do without #145: giving the brand voice a home. That is this design.

Its open question 3 arrives independently at the same answer, which is worth recording as
corroboration rather than paraphrasing:

> the system should ship the _shape_ — a ranked tone list, a chrome/content line, a
> use/avoid table — and Miltinson's filled-in version becomes the worked example. That is
> the same move `docs/agents/product-token-layer.md` already makes for tokens.

Close #159 as resolved-by-#145 once PR 3 lands, and re-point its stale body at #136 in the
closing comment so the record is not confusing later.

### Named as unsettled: is the avoid list system-level?

#159's open question 1 is the one thing this design does **not** settle, and it is left
explicit rather than dropped, per #145's first acceptance criterion.

`build, ship, practical, honest` is plainly a house style. `synergy, leverage, unlock,
empower, seamless` reads as a blocklist any product would accept — which would make it the
system's, not the pack's. There is a tempting resolution — the generic half belongs to the
**chrome** rule `@elirobinson/eslint-config` already enforces, not to a voice pack at all —
and it is tempting enough to be worth resisting until it is decided on purpose, because
`patterns.md:84` forbids that rule from reaching editorial voice and a system-level avoid
list applied to content would breach the very carve-out this design is built on.

So `schema.mjs` marks every section `product` for now. The `system`/`product` marking exists
in the schema from day one precisely so promoting `words.avoid` later is a one-field change
rather than a format change. #159's open question 2 (does the tone ranking apply to a
consumer, or is it Miltinson's ordering of universal virtues?) is left open on the same
terms.

## Two fixes that are correct regardless

- `design-system-docs/patterns/invoice/invoice.html:39` renders a real postal address and
  `eli@miltinsons.com` on the public `/brand/patterns`. The "Billed to" block beside it is
  already fictional (`Harrogate Junior FC`, `sam@example.com`); the asymmetry is the tell.
  Replace the From block with a matching fiction.
- `design-system-docs/ui_kits/_shared/Primitives.jsx:19` paints the wordmark's period
  `oklch(72.5% 0.175 65)` — `--signal-500` under `ember`, written as a constant, and the
  only colour literal in the shipped kits. The wordmark therefore stays amber under
  `data-palette="slate"` and under `data-palette="miltinson"`. Replace with `var(--accent)`,
  which is safe because `colors_and_type.css` ships beside the kits in `BRAND_SOURCES`.

## Sequencing

Five PRs. Each touches `packages/`, so **each needs a changeset** —
`design-system-docs/` alone would not, but no PR here is confined to it.

| PR  | contents                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `docs/agents/brand-boundary.md`; one line in `AGENTS.md`'s topic guides; the invoice address; the `Primitives.jsx` literal; the `ui_kits` colour-literal guard test                                                |
| 2   | #142 — `schema.mjs`, `render.mjs`, `miltinson.voice.json`, the round-trip test, and the three surfaces rendered from it (README block, `brand-voice.html`, `contracts.json`) plus the voice page's link re-pointed |
| 3   | the dial — `resolve.mjs`, `starter.voice.json`, `ds init --voice`, `ds voice`, `get_brand_guidance` fallback and relabel, `llms.mjs` `## Brand` → `## Voice`                                                       |
| 4   | `ui_kits/_shared/content.js`                                                                                                                                                                                       |
| 5   | `brand-boundary.test.mjs`; amend `product-token-layer.md:149`; amend `guideline-cards.mjs`'s docblock; post the recorded answers on #145                                                                           |

PR 1 leads because the rest cite the rule it writes down, and because the invoice address
should not wait on a design.

**PR 2 got cheaper than first estimated, and #136 is why.** The initial read of this plan
put the bulk of the work in generating the docs site's voice page from data. That page no
longer carries the material, so PR 2's generated surfaces are `brand-voice.html`, one new
managed block in `README.md`, and a derived field in `contracts.json` — three, all of them
build-time artifacts nobody hand-edits after this lands. The remaining risk in PR 2 is the
round-trip fidelity of the README block, not the rendering strategy.

## What is deliberately not here

- **No new package.** `@elirobinson/miltinson-brand` (#145's option 2) is a reasonable later
  destination and not a prerequisite. Another package in the release train is only worth it
  if the brand layer grows.
- **No separate repo.** #145's option 3 breaks `brand-manifest.json`, which is built by
  walking `design-system-docs/` at build time and read by `apps/docs` to render `/brand/*`.
- **No rename of the system, the palette, or the fonts.**
- **No change to `packages/react` or `packages/eslint-config`.** Both are already on the
  correct side of the boundary, and `eslint-config` is the thing this design brings the rest
  of the repo into line with.
