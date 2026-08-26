# Editorial audit — docs site voice

Working document for [#130](https://github.com/EliRobinson/design-system/issues/130) (the voice
page is out of date) and [#128](https://github.com/EliRobinson/design-system/issues/128) (the site
reads as AI marketing). Annotate it in place — the open questions at the end are the ones that
have to be answered before the rest of #128 can be finished.

Scope of the sweep: every MDX page under `apps/docs/src/app/(docs)/`, the page components under
`apps/docs/src/app/`, hard-coded copy in `apps/docs/src/components/`, `apps/docs/src/lib/editorial.ts`,
and page metadata. `packages/` prose is inventoried separately in the last section, because
changing it has a release consequence the docs site does not.

## Headline

|                                                                        |                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| First-person lines, all kinds                                          | **29**                                                       |
| …of those, the brand speaking as "I"                                   | **21** (6 in the docs' own voice, 15 in shipped sample copy) |
| Sentences carrying an AI-marketing tic                                 | **36**                                                       |
| Tic instances across those sentences                                   | **47**, over 7 tics                                          |
| Empty intensifiers ("seamless", "powerful", "robust", "effortless", …) | **0**                                                        |

That last row is the finding that reframes #128. The vocabulary the voice page bans does not
appear anywhere on the site. What reads as generated is not word choice — it is a small set of
**structural** habits, concentrated almost entirely in the one layer of prose that has nothing
to derive from: the home page, the section landing blurbs, and page lead paragraphs. Everything
downstream of the manifest is already written in the house voice.

## 1. First-person inventory

### 1a. The docs speaking in their own voice as "I" — 6 lines

This is #130's literal complaint. A reader on `/installation` is being told what one specific
person prefers, in a document that is otherwise a spec.

| file:line                                                   | text                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/docs/src/app/page.tsx:80`                             | "I run several small products under one name, and this system keeps them consistent…"         |
| `apps/docs/src/app/(docs)/installation/page.mdx:14`         | "A package manager — I use pnpm, but npm and yarn work the same way"                          |
| `apps/docs/src/app/(docs)/components/button/page.mdx:26`    | "reserve it for the one action I most want taken."                                            |
| `apps/docs/src/app/(docs)/guidelines/voice/page.mdx:10`     | "**I speak as myself.** First person singular…"                                               |
| `apps/docs/src/app/(docs)/guidelines/voice/page.mdx:38–39`  | "…and 'we' when I mean 'I'."                                                                  |
| `apps/docs/src/app/(docs)/components/rule-link/page.mdx:20` | "'View all guides,' 'See what I build.'" — a sample label, but presented as the canonical one |

### 1b. The brand speaking as "I" inside shipped sample copy — 15 lines

Every component demo doubles as a portfolio-site mock. A consumer evaluating `Textarea` reads
"Tell me what you need help with…" three times.

| file:line                                                       | text                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/docs/src/app/(docs)/patterns/hero/page.mdx:22`            | "I'm Eli Robinson — I build software, teach AI, and create resources for coaches." |
| `apps/docs/src/app/(docs)/patterns/forms/page.mdx:25`           | "Tell me what you need and I'll get back to you within 24 hours."                  |
| `apps/docs/src/app/(docs)/patterns/forms/page.mdx:33`           | "I reply from eli@miltinsons.com — add it to your contacts."                       |
| `apps/docs/src/app/(docs)/patterns/header/page.mdx:40`          | "Hire me"                                                                          |
| `apps/docs/src/components/demos/rule-link/List.tsx:8`           | "See what I build"                                                                 |
| `apps/docs/src/components/demos/card/WithContent.tsx:19`        | "Tell me what you need — no contracts required."                                   |
| `apps/docs/src/components/demos/card/WithContent.tsx:25`        | "Hire me"                                                                          |
| `apps/docs/src/components/demos/input/WithHint.tsx:11`          | "I'll get back to you within 24 hours."                                            |
| `apps/docs/src/components/demos/textarea/Basic.tsx:6`           | "Tell me what you need help with…"                                                 |
| `apps/docs/src/components/demos/textarea/WithHint.tsx:9`        | "Tell me what you need help with…"                                                 |
| `apps/docs/src/components/demos/textarea/WithHint.tsx:10`       | "Aim for 2–3 sentences — I'll follow up with questions."                           |
| `apps/docs/src/components/demos/textarea/WithError.tsx:9`       | "Tell me what you need help with…"                                                 |
| `apps/docs/src/components/demos/decision-card/NoAction.tsx:20`  | "I'd skip it and put the $240 toward the replacement instead."                     |
| `apps/docs/src/components/demos/accordion/Basic.tsx:30`         | "…re-download from your order confirmation email any time I ship an update."       |
| `apps/docs/src/app/(docs)/components/decision-card/page.mdx:62` | "remind me later" — reader-voice, listed for completeness                          |

### 1c. Reader-voice "me/my" — 6 lines, not a defect

`checkbox/Basic.tsx:6`, `chat-thread/Basic.tsx:10`, `tabs/Basic.tsx:29`,
`accordion/Basic.tsx:21`, `accordion/Basic.tsx:28`, `decision-card/page.mdx:62`. These are the
_user_ speaking inside a demo, which is correct. Left alone.

`installation/page.mdx:123` contains the literal CLI argument `my-app`. Not first person.

### 1d. The upstream copy — flagged, not touched

`design-system-docs/README.md:67` says **"Eli speaks as himself."** and that file is the brand
source of truth: `@elirobinson/ai-patterns` exports it as `./brand-readme`, and `llmsFull()`
extracts its `## CONTENT FUNDAMENTALS` section into `/llms-full.txt`. So the first-person rule
is not only on the docs page — it is **published to every consuming agent**. `ai-corpus.test.ts:109`
asserts the string `Never the royal "we."` appears in the corpus, so changing it fails CI here
too. See §5.

## 2. AI-marketing inventory

Method: pattern-grep the prose corpus for each construction, then hand-classify each hit as
**load-bearing** (the sentence carries a fact you could act on or check) or **unearned** (it
carries cadence only). Only unearned instances are counted below. This matters most for the
antithesis tic: the corpus has ~140 `X, not Y` constructions and the great majority are real
technical disambiguations — "it's a `<span>`, not a control", "44px, not the dense scale". Those
are the house voice working correctly. Fifteen are not.

| #   | Tic                              | Instances                      |
| --- | -------------------------------- | ------------------------------ |
| 1   | Unearned X-not-Y antithesis      | 15                             |
| 2   | Aphoristic closer                | 11                             |
| 3   | Slogan heading                   | 7                              |
| 4   | Promise with no mechanism        | 6                              |
| 5   | Em-dash appositive doing no work | 4                              |
| 6   | Tricolon of moods                | 4                              |
| 7   | Empty intensifiers               | 0                              |
|     | **total**                        | **47** across **36** sentences |

### Tic 1 — unearned X-not-Y antithesis (15)

The second term names something nobody was going to do. "Pillowy", "a vibe", "levitation" and
"bolted on" are not alternatives a reader was weighing; they exist to give the sentence a shape.

| file:line                                            | text                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `app/page.tsx:11`                                    | "Miltinson Amber is the only shout — a signal, never a fill." |
| `app/page.tsx:14`                                    | "Sharp, not pillowy" (card title)                             |
| `app/page.tsx:15`                                    | "motion that confirms instead of performing"                  |
| `app/page.tsx:19`                                    | "built into the tokens, not bolted on"                        |
| `app/(docs)/components/page.tsx:16`                  | "The tier boundary is a rule, not a vibe."                    |
| `app/(docs)/foundations/motion/page.mdx:8`           | "Motion here confirms what happened — it never performs."     |
| `app/(docs)/foundations/color/page.mdx:10`           | "used as a signal, never a fill"                              |
| `app/(docs)/foundations/color/page.mdx:24`           | "It anchors; it doesn't shout."                               |
| `app/(docs)/foundations/radii-elevation/page.mdx:22` | "a hairline tint that reads as paper, not levitation"         |
| `app/(docs)/foundations/spacing/page.mdx:18`         | "Cramped sections read as clutter, not density."              |
| `app/(docs)/foundations/accessibility/page.mdx:5`    | "Accessibility is a foundation here, not a review step."      |
| `app/(docs)/build-with-ai/page.mdx:42`               | "versioned with the system, not pasted from a wiki"           |
| `app/(docs)/adoption/page.mdx:7`                     | "none of them requires a big-bang rewrite"                    |
| `app/(docs)/guidelines/voice/page.mdx:20`            | "a trusted hand, not a gatekeeper"                            |
| `lib/editorial.ts:8`                                 | "keyed to a domain rather than to how much is assembled"      |

Note that `app/page.tsx:11` and `foundations/color/page.mdx:10` are the _same sentence_, written
twice by hand — see §4.

### Tic 2 — aphoristic closer (11)

A final short sentence that restates the paragraph as a slogan and adds no fact. It is the single
most recognisable generated-prose signature, and it is the tic that dominates the home page.

`app/page.tsx:11` · `app/(docs)/components/page.tsx:16` · `foundations/motion/page.mdx:8`
("Calm and purposeful.") · `foundations/motion/page.mdx:30` ("The content is the show.") ·
`foundations/spacing/page.mdx:9` ("a magic number is a bug waiting for a redesign") ·
`foundations/spacing/page.mdx:18` · `foundations/radii-elevation/page.mdx:15` ("a pill button
reads as a different brand") · `patterns/footer/page.mdx:6` ("it's deliberately quiet") ·
`guidelines/voice/page.mdx:6` ("Every string in a product … is brand surface.") ·
`guidelines/voice/page.mdx:21` ("let the work speak") · `lib/editorial.ts:8`

### Tic 3 — slogan heading (7)

A heading that asserts a stance instead of naming what is beneath it. Every one of these also
costs the reader the ability to scan.

`app/page.tsx:14` ("Sharp, not pillowy") · `app/page.tsx:22` ("Agents are users too") ·
`app/page.tsx:104` ("What the system believes") · `app/page.tsx:116` ("Find your way in") ·
`app/page.tsx:128` ("Pointing an agent at this?") · `foundations/motion/page.mdx:22` ("Feel it") ·
`build-with-ai/page.mdx:8` ("Coding agents are first-class users of this system.")

### Tic 4 — promise with no mechanism (6)

The rule for these is delete, not reword: if the mechanism existed the sentence would name it,
and every other page on this site does name it.

| file:line                               | text                                                                          | why                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `app/page.tsx:23`                       | "imports the right thing on the first try"                                    | the manifest guarantees the specifier resolves; it cannot guarantee first-try |
| `app/page.tsx:82`                       | "No fluff, no dark patterns"                                                  | nothing in the system detects a dark pattern                                  |
| `foundations/accessibility/page.mdx:6`  | "you inherit most of this for free"                                           | "most" is doing the work; the checkable list follows two lines later          |
| `foundations/accessibility/page.mdx:24` | "the system's most misunderstood policy"                                      | no data                                                                       |
| `patterns/footer/page.mdx:5`            | "the most recognizable Miltinson surface after the wordmark"                  | no data                                                                       |
| `guidelines/voice/page.mdx:5`           | "sounds like one person who builds things and tells you the truth about them" | unfalsifiable                                                                 |

### Tic 5 — em-dash appositive doing no work (4)

The house style uses em-dashes heavily and mostly well — the clause after the dash usually adds
the mechanism. These four restate the clause before it.

`app/page.tsx:11` · `app/page.tsx:19` · `foundations/accessibility/page.mdx:6` ·
`guidelines/voice/page.mdx:27` ("Em-dashes are the favored break — like this one.")

### Tic 6 — tricolon of moods (4)

Three or more items where the items are dispositions, not things. Contrast with
`app/page.tsx:47` ("live demos, generated props tables, and keyboard contracts") — three real
artifacts, load-bearing, left alone.

`app/page.tsx:82` ("No fluff, no dark patterns, accessible by default") ·
`foundations/motion/page.mdx:8` ("Calm and purposeful.") ·
`guidelines/voice/page.mdx:18–21` (the four-item weighted tone ranking — nothing consumes the
ranking) · `guidelines/voice/page.mdx:35` (a ten-word "words to use" list)

### Tic 7 — empty intensifiers (0)

Grepped for `seamless`, `effortless`, `powerful`, `robust`, `delightful`, `elegant`,
`cutting-edge`, `world-class`, `unlock`, `empower`, `leverage`, `revolutionary`,
`game-changing`, `comprehensive`, `streamline`, `supercharge`, `frictionless`, `intuitive`,
`designed to`, `built to`, `crafted`, `enables you to`, `makes it easy`. Zero hits outside the
voice page's own blocklist and the single phrase "first-class users" (counted under tic 3).

**The blocklist is not the problem, and adding to it will not fix #128.**

## 3. Proposed voice standard

`CLAUDE.md`, `docs/agents/*.md`, `packages/ai-patterns/src/patterns.md`, and the source comments
throughout `packages/` and `apps/docs/src/lib/` are already written in a specific and consistent
voice. It is a better brand voice than the one the voice page describes, it is what a reader
actually meets everywhere except the marketing layer, and it is the thing the docs site has
drifted away from. The proposal is to write it down as the standard rather than invent one.

**The standard, four lines:**

1. **Say the mechanism, or say nothing.** A claim about the system is followed by the file, the
   command, the token, or the test that makes it true. If naming one is not possible, the claim
   is not ready to publish.
2. **Record what failed.** Rules earn their keep by naming the thing that went wrong before them.
   The reader trusts a rule with a scar on it.
3. **The reader is "you." The system is the subject.** No first person in the system's own voice.
4. **Delete the last sentence.** If a paragraph ends on a phrase that restates it more
   memorably, that phrase is the tic. Cut it and check whether anything was lost.

**The evidence that this is already the house voice:**

- `docs/agents/git-workflow.md` — four prior PRs, tabulated, each with the exact wrong link form
  and the exact way it broke. It does not say "link screenshots carefully."
- `packages/ai-patterns/src/patterns.md:38–43` — "`@elirobinson/react` went from 24 flat
  components to 45 … every hand-written inventory silently rotted, while `ds` … kept working
  untouched. That is the whole reason the CLI exists."
- `apps/docs/src/lib/site-map.ts:5` — "never a hand-kept list, which existed in three copies";
  and `:30–31`, which explains that title-casing `ai` gives "Ai", "which reads as a typo rather
  than as a label". That is an antithesis that earns itself: both alternatives are real.
- `apps/docs/scripts/assert-static-routes.mjs:1–14` — states the rule, the failure mode it
  prevents, and where it runs, in three sentences with no closer.
- `apps/docs/src/components/foundations/SemanticColorTable.tsx:28` — "An empty group throws
  rather than rendering nothing. It used to return null…"

Every one of those has the same shape: **claim → mechanism → the failure it prevents.** That is
the standard, and it is why the manifest-derived pages already pass and the hand-written
marketing layer does not.

## 4. The cardinal-rule bugs — stronger than the tone findings

`CLAUDE.md`: _nothing we publish may require a consumer to update prose when this repo changes._
Three violations found, all on the voice page or adjacent to it.

**4a. The brand voice word lists exist in three hand-kept copies, and all three disagree.**

| copy                                                           | "use" list | "avoid" list |
| -------------------------------------------------------------- | ---------- | ------------ |
| `design-system-docs/README.md:89, 93` — the source of truth    | 19 items   | 16 items     |
| `apps/docs/src/app/(docs)/guidelines/voice/page.mdx:35, 37–39` | 10 items   | 15 items     |
| `design-system-docs/guidelines/brand-voice.html`               | 8 items    | 8 items      |

Concretely: the README's use-list carries `trusted, patient, fun, interactive, no contracts, get
started, get in touch, follow-up` and neither of the others does. The README's avoid-list carries
`AI-powered (used flatly)` and neither of the others does. `brand-voice.html` drops `robust,
cutting-edge, world-class, frictionless, reimagine, ninja, rockstar` from the avoid-list. On
emoji the README says "sparingly" and sanctions `✓` in service-tier lists; the page said no
decorative emoji at all.

This is not a latent risk — it is already broken in production. The README is exported as
`@elirobinson/ai-patterns/brand-readme` and extracted into `/llms-full.txt`, so an agent gets
version 1. `brand-voice.html` renders as a live card on `/brand/guidelines`, so a human browsing
the site gets version 3. The voice page gave them version 2. Three answers on one site, exactly
the failure mode `patterns.md §5` was written about.

`design-system-docs/README.md:229–242` is a fourth instance of the same shape: the Lucide
iconography rule, restated on the voice page as "a Lucide icon at 1.5px stroke".

**4b. The page restates rules that already ship as a lint rule and a contract.**
`packages/eslint-config/src/rules/copy-patterns.mjs` enforces the chrome-copy rules (frequency
claims, blame attribution, filler pacing, unprompted reassurance, unasked escalation,
enthusiasm) on copy props and chrome-component children. `packages/ai-patterns/src/contracts.json`
carries `systemPromptStyle.voice` and the `functional-copy` constraint, served by `ds contracts`
and by the MCP's `get_brand_guidance`. The voice page's "In components" section paraphrases a
subset of that in prose, where it cannot be checked and will not be updated.

**4c. One sentence is written out twice by hand.** "Miltinson Amber … a signal, never a fill"
appears at `app/page.tsx:11` and `foundations/color/page.mdx:10`.

The fix for 4a and 4b is the same shape as the rest of this repo: the page should say what the
voice _is_ in the register above, and point at the command for anything enumerable — not carry
a second copy of the list.

## 5. `packages/` prose — flagged, not changed

Changing anything here needs a changeset and ships to consumers, so it is deliberately excluded
from this PR.

- `design-system-docs/README.md:61–110` — the CONTENT FUNDAMENTALS block. **This is the real
  #130 fix.** Until it changes, "Eli speaks as himself" is what every agent is told. Note
  `apps/docs/src/lib/ai-corpus.test.ts:109` asserts on `Never the royal "we."`, so the test moves
  with it.
- `packages/ai-patterns/src/contracts.json:3` — `"voice": "practical, honest, warm"`. Consistent
  with the README's tone ranking; survives a move away from "I" unchanged. Probably fine as is.
- `packages/ai-patterns/src/patterns.md` — swept: **0 first-person, 0 intensifiers.** §6 "UI Copy
  Is Chrome" is the best prose in the repo and is the model for §3 above. No changes proposed.
- `packages/ai-patterns/src/agents/{AGENTS,SKILL,copilot-instructions}.md` and
  `src/prompts/*.md` — swept: **0 first-person, 0 intensifiers.** No changes proposed.

## 6. What this PR changes, and what it leaves

**Rewritten:**

- `apps/docs/src/app/(docs)/guidelines/voice/page.mdx` — full rewrite (#130). Heading slugs
  changed; the only inbound link is `foundations/accessibility/page.mdx:53`, which points at the
  page and not at an anchor, so nothing breaks.
- `apps/docs/src/app/page.tsx` — home hero, the four principle cards, the three section headings.
- `apps/docs/src/app/(docs)/components/page.tsx` — the lead.
- `apps/docs/src/app/(docs)/build-with-ai/page.mdx` — the lead and the template blurb.
- `apps/docs/src/app/(docs)/foundations/{motion,spacing,color,radii-elevation,accessibility}/page.mdx`
  — leads and the aphoristic closers only; the rules underneath are untouched.
- `apps/docs/src/lib/editorial.ts` — the `ai` tier intro.
- `apps/docs/src/app/(docs)/installation/page.mdx:14` and
  `apps/docs/src/app/(docs)/components/button/page.mdx:26` — the two first-person lines that read
  the same under any answer to Q1.

**Deliberately left, listed as remaining work for #128:**

- `foundations/radii-elevation/page.mdx:15` — "a pill button reads as a different brand". Counted
  as tic 2, but it is the only stated reason the pill radius is banned for CTAs, and deleting it
  loses the rationale. Needs a replacement reason, not a cut.
- `patterns/{hero,forms,header}/page.mdx` and every `components/demos/*` file — the 15 lines in
  §1b. This is a sample-content decision, not a copy edit: replacing the persona means choosing
  a new one, and it touches ~20 files. Worth its own issue.
- `patterns/footer/page.mdx:5–6` and `adoption/page.mdx:7` — one tic each.
- The 50 component pages. Swept and clean: their antitheses are load-bearing and their leads name
  mechanisms. No work found.
- `design-system-docs/README.md` — see §5.

## 7. Open questions for the maintainer

**Q1. What replaces "I"?** Three candidates, and the choice decides §1a, §1b, and 4a:

- **(a) The system as subject.** "The system ships two stylesheets." Matches the house voice in
  `docs/agents/*` and `patterns.md` exactly, and is the register a spec is normally written in.
  Assumed by the draft rewrite in this PR, because it is the only one that can be written without
  an answer from you.
- **(b) Second person throughout.** "You import two stylesheets." Warmer, and closer to the
  existing tone ranking, but it cannot state facts about the system without a subject, so in
  practice it becomes (a) plus more "you".
- **(c) A named org — "Miltinson".** "Miltinson ships two stylesheets." Only viable if the brand
  is genuinely becoming an org rather than staying a person's work; it would also mean the
  README's "Never the royal 'we'" rule is the thing that has to change.

**Q2. Whose voice is this page describing — the system's, or the consumer's product's?**
The page currently conflates them, and that conflation is arguably the root cause of #130. Lines
5–39 describe _Miltinson's own marketing voice_ (pricing conventions, the wordmark's period,
taglines). Lines 47–53 describe _rules a consumer's product must follow_ (button labels are
verbs, error messages name the problem then the fix). A consumer building an unrelated app needs
the second and must ignore the first, and nothing on the page tells them which is which.

`patterns.md §6` already draws this line precisely and calls it **chrome vs. content** —
chrome is governed by the system and lint-enforced; a product's editorial voice is explicitly out
of scope. Three options:

- **(a) Split the page.** `/guidelines/voice` becomes the chrome standard only, applying to every
  consumer. The Miltinson-specific brand voice moves to `/brand/` where the rest of the
  brand-specific material already lives.
- **(b) Keep one page, label the two halves.** Cheaper; still leaves one page carrying two
  audiences.
- **(c) Keep it Miltinson-only** and say so in the first line, accepting that a consumer building
  a non-Miltinson product gets nothing from it.

The draft in this PR takes **(a)**, in the form that requires no decision from you: the page now
covers chrome only, and the brand-voice half is a link to `/brand/guidelines` and the README
rather than a copy of them. That fixes 4a without settling what the brand voice _is_ — whatever
you decide about "I", the page stays correct, because it no longer states it.

**Q3. Does the tone ranking survive?** "Practical / Honest / Warm / Quietly confident", weighted
in that order, appears on the page and in the README. Nothing reads the ranking and no decision
has ever turned on it. Keep as brand-level guidance, or drop it as tic-6 padding?

**Q4. Is the sample-copy persona in scope?** §1b is 15 lines across ~20 demo files. Replacing
"Eli Robinson, coach-resources" with a generic persona is a bigger, more visible diff than
everything else here combined. Separate issue, or fold into #128?
