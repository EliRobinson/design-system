# @elirobinson/ai-patterns

## 0.27.8

### Patch Changes

- add781c: A published file may not import a package its manifest never declared, and a test now says
  so for every package in the workspace.

  `dependency-boundary.test.mjs` reads what each `files` field actually resolves to and
  fails on any import that is not a `dependency`, a `peerDependency`, an
  `optionalDependency`, a Node builtin, a relative path or the package's own name. It goes
  red on the 41 files `@elirobinson/react` was publishing before this release, which is what
  it was written against.

  The reading of `files` moved out of `brand-boundary.test.mjs` into
  `published-files.test-helper.mjs`, shared by both suites rather than reimplemented. npm's
  negation semantics are subtle enough — an interior `**` is an optional run of segments,
  only a trailing one is greedy — that a second implementation would be a second chance to
  get them wrong in the direction that fails by passing, which is the drift #214 was about.
  Neither file is published: the `.test-helper.mjs` suffix is already excluded by this
  package's `files`.

## 0.27.7

### Patch Changes

- 922a2a4: The brand-boundary check scans everything the packages publish, not two directories.

  `brand-boundary.test.mjs` opened by asserting that no published artifact carries a brand
  term outside a permitted file, and scanned `dist/artifacts` plus the agent templates. Both
  `@elirobinson/ai-patterns` and `@elirobinson/tokens` list `src` in `files`, so most of
  published source was never looked at — which is how a banner naming one consumer survived
  the run that caught three others (#214, #213).

  The file set is now derived from each package's own `files` field, negations included, so
  the exclusions are the manifest's rather than a second list that can drift from it. A
  `files` entry that resolves to nothing throws instead of silently shrinking the scan.

  Two shipped comments in this package used the company name as their worked example —
  `src/artifacts/llms.mjs` explaining what the `llms.txt` intro stopped saying, and
  `src/voice/schema.mjs` explaining why a pack carries a short mark and a legal name as
  separate fields. Both now use a placeholder, which carries the lesson without shipping the
  string. The reasoning is recorded in `docs/agents/brand-boundary.md`, along with why the
  published changelogs are permitted rather than rewritten.

## 0.27.6

### Patch Changes

- ecd0dd3: `ds-resync` now checks its own version against the registry and warns loudly when the running copy is behind the latest release, instead of trusting the version it was built at.

  `pnpm dlx`/`npx` can hit a registry auth error while resolving what to run and silently fall back to whatever build is sitting in the dlx cache instead of failing (#211). That left `ds-resync artifacts` and the default version-sync command reporting against an old cached binary with no indication anything was wrong. The check runs before both commands and is best-effort — a registry problem checking itself is swallowed, since it should never be the reason an otherwise-offline-capable command stops working.

## 0.27.5

### Patch Changes

- 462beb5: The brand boundary is enforced by a test, and four artifacts stop asserting one consumer as a rule of the system.

  `docs/agents/brand-boundary.md` stated the rule; a rule documented only in prose is a rule
  that drifts, which is how one consumer's price format, wordmark punctuation and product
  line came to ship to every other consumer as the design system's own guidance.

  `brand-boundary.test.mjs` asserts two things mechanically: no published artifact contains a
  brand term outside a permitted file, and the permitted set is exactly the set the doc's
  table names — double-entry, so neither side can move without the other.

  It found four things on its first run. The corpus described the system as being "for
  Miltinson Technologies products", in the first paragraph an agent reads. The three token
  stylesheets carried a "Miltinson Technologies — Design Tokens" banner, where the system's
  own name is Miltinson Design System. The `miltinson` palette's docblock named one
  consumer's domain. And an email template's CTA pointed at that domain, which surfaced in
  the shipped brand manifest.

  The voice pack's own content still ships, labelled a default — permitted as a section
  rather than by unguarding the artifacts that carry it.

## 0.27.4

### Patch Changes

- e2dcb65: Collapse the duplicated frame settle in `waitForStablePixels`

  Two fixes for the same flake landed independently, so the settle promoted
  `loading="lazy"` frames to eager twice and waited for embedded documents to
  finish parsing twice. Idempotent, but the same mechanism was described by two
  comment blocks that had drifted apart — the second claimed no guard above it
  could see embedded documents, which the per-frame loop directly above it does.

  One de-lazy pass and one readiness wait now, keeping the stricter
  `fonts.status === 'loaded'` condition and the measurements from both
  investigations. The `fonts.status` half had shipped without a test; it has one
  now, along with tests for the parsing and cross-origin cases.

## 0.27.3

### Patch Changes

- e54aac8: The shipped UI kits keep their structure and hand their strings to one file.

  The four kits — marketing, webapp, mobile, docs — are useful surface archetypes and that
  taxonomy is the system's. The 41 Miltinson strings spread across 13 of their files were
  not: a reskin meant 41 edits, and a re-crossing of the boundary was invisible.

  Everything a consumer would have to rewrite now lives in `ui_kits/_shared/content.js`.
  Three components are renamed for the same reason: `CoachingBand` → `FeatureBand`,
  `RecipesScreen` → `BrowseScreen`, `MathsScreen` → `PracticeScreen`.

- ee87848: `waitForStablePixels` waits for lazy iframes and their contents, not just the parent document.

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

## 0.27.2

### Patch Changes

- d5a97c1: Settle every frame before a visual capture, not just the main one

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

## 0.27.1

### Patch Changes

- e75165d: Regenerated corpus and packed artifacts, for `DecisionCard`'s move to `molecules/`.

  No source or API change here. The artifacts under `dist/artifacts/` — `llms.txt`,
  `llms-full.txt`, `brand-manifest.json`, and the packed skills — are built from
  `@elirobinson/react`'s manifest, so they carried `organisms/DecisionCard` as the import
  path an agent should write. They now carry `molecules/DecisionCard`.

  This needs its own release rather than riding along silently: an agent reading the shipped
  corpus is being handed an import path, and a published corpus that still says
  `organisms/DecisionCard` after `@elirobinson/react` v3 hands it one that does not resolve.

## 0.27.0

### Minor Changes

- 41546c1: The brand voice is a dial now, and what ships is labelled a default rather than a rule.

  `palettes.css` made this move for colour: Miltinson's colours were contributed as a named
  palette and amber stayed the default without being a rule, because `data-palette` made
  "default" mean something. Prose had no such dial, so the same 51 lines read as the system's
  instruction rather than as one pack among possible packs.

  A consumer declares its own voice by creating `voice.json` at its repo root — presence is
  the declaration, there is no config key. `ds init --voice` scaffolds one and refuses to
  overwrite an existing one. `ds voice` prints the pack in force and where it came from.

  `get_brand_guidance` and `/llms-full.txt` now name the active pack, and the MCP returns the
  consumer's when one is declared. A consumer that declares nothing still gets the full
  default pack, not an empty schema: an empty schema would be a real regression in what the
  tarball is worth. A malformed consumer pack throws rather than falling back, because
  getting someone else's voice silently is the defect this layer closes.

## 0.26.1

### Patch Changes

- 2ad0458: Test-harness only: `render()` in the browser contract suite now resets the
  viewport to the top of the document after `setContent`.

  `setContent` replaces the document but does not reset the scroll offset, and the
  offset survives whenever the incoming page is tall enough to hold it. Every fold
  case in that file assumes a fresh render starts at the top, so a test that left
  the page scrolled handed the next one a viewport already past the fold — green in
  isolation, red in sequence, reporting a fold problem rather than a scroll one.

  Nothing shipped changes; this is the suite that guards `checkTouchTargets` and
  `checkHitAreaOverlap`, not the checks themselves.

## 0.26.0

### Minor Changes

- b6d467b: `checkHitAreaOverlap()` can see below the fold, so a control that swallows its neighbour is
  reported wherever it sits on the page.

  `document.elementFromPoint` only answers for the visible viewport. Nothing scrolled, so a
  sibling past the first screenful was probed at a coordinate the browser cannot see: it
  answered `null`, `null` is neither the control nor contained by it, both branches of the
  comparison were false, and the loop moved on having established nothing. Not a crash and not
  a noisy false positive — a silent false negative on every page taller than the window, which
  is the normal case rather than the edge case. `expectDesignSystemContracts(page)` certified
  hit-area behaviour it had never measured, and a green result was indistinguishable from a
  genuinely clean page.

  This is the same defect [#79](https://github.com/EliRobinson/design-system/issues/79) /
  [#133](https://github.com/EliRobinson/design-system/pull/133) fixed in `checkTouchTargets()`,
  in the sibling function, left alone there so that PR stayed one function wide.

  Each sibling is now scrolled into view — `scrollIntoView({ block: 'center', inline: 'center',
behavior: 'instant' })` — before its centre is probed, and its box is re-read afterwards. The
  sibling is what moves, because the sibling's centre is what gets probed; the control is still
  on top of it because the loop only ever walks `control.parentElement.children`, so the two
  share a parent and scroll together. That is asserted rather than assumed.

  **A probe that fails is no longer counted as a clean result.** Four answers replace two:
  - **covered** — reported as `hit-area-no-overlap`, as before.
  - **not covered** — silent, as before.
  - **off-canvas**, which scrolling cannot rescue (a skip link at `top: -40px`, a closed
    drawer) — silent. Nothing a user cannot reach can be deprived of a hit area.
  - **on screen and routed nothing** — reported as `hit-area-unmeasurable`, a stated gap in the
    check rather than a violation, mirroring `touch-target-unmeasurable`. Consumers holding a
    suite green may see this appear; it means a sibling went unchecked, not that a control is
    wrong. Look for `pointer-events`, a clipping ancestor, or a transform that moves the
    sibling off its box.

  A sibling **taller than the viewport** is probed at the centre of whatever part of it is on
  screen rather than excused. `checkTouchTargets` lets an unmeasurably large surface pass on
  its painted geometry, because the question there is "is this box big enough" and an oversized
  box plainly is. The question here is "is this sibling covered", and being tall is no reason to
  stop asking.

  The page is put back where it was found — every scrollable container, not just the window,
  because `scrollIntoView` walks the whole ancestor chain. This check runs inside somebody
  else's test, in front of somebody else's screenshot.

  **What did not change:** the `sr-only` guard [#131](https://github.com/EliRobinson/design-system/pull/131)
  added still runs, and now runs against the many more siblings reaching below the fold exposed.
  `sr-only` is 1x1 at its control's static origin, so its centre routes to the control, and
  probing it would report every accessible-name-only label on the page.

  The scroll-and-probe block is a deliberate near-copy of the one in `checkTouchTargets`, not a
  shared helper: #131 established that each check's helpers live inside its own `page.evaluate`
  closure, which is serialised to the browser and cannot close over module scope, so sharing
  would mean eval-ing a source string — ruled out by this module's strict-CSP promise. Both
  copies now carry a note pointing at the other, because a silent divergence between them is
  its own bug.

  `tests/visual/contracts.ts` runs with `touchTargets: false` pending #65, so this repo's own
  suite would not have caught it. The exposure was consumer-side.

## 0.25.0

### Minor Changes

- e8a3a5c: The brand voice is a pack, and the four surfaces that state it are generated from that one file.

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

## 0.24.1

### Patch Changes

- 801f89b: The shipped wordmark follows the palette dial, and the UI kits are guarded against colour
  literals.

  `ui_kits/_shared/Primitives.jsx` painted the wordmark's period `oklch(72.5% 0.175 65)` —
  `--signal-500` under `ember`, written as a constant — so the wordmark stayed amber under
  `data-palette="slate"` and under `data-palette="miltinson"`, which is the palette
  miltinsons.com actually renders in. It now reads `var(--accent)`.

  It was not the only one. Four of the five JSX kit files carried colour literals: white and
  black text, hairline borders and card shadows written as `oklch(100% 0 0 / …)` and
  `#fff`/`#0a0a0a`. Each now reads a token, and the four that needed a specific alpha keep
  it exactly, built with `color-mix()` from a token rather than restated as a literal.

  They survived because `eslint.config.mjs` ignores `design-system-docs/**` wholesale, so
  `no-hardcoded-design-values` never saw them. The kits are static JSX and HTML with no build
  step, so un-ignoring them would cascade; a test guards the kits instead. Its detector strips
  comments before matching, so a `#119`-shaped issue reference in prose is not mistaken for a
  colour, and a table of cases pins both halves of that behaviour.

  The comment stripper itself is now string-literal-aware, and language-aware. It used to be a
  pair of regexes, which meant a `/*` or `<!--` sitting inside a JS string or template literal
  would have been read as a real comment opener, silently deleting everything up to the next
  `*/` — including any genuine colour literal in between. It is now two single-pass character
  scanners, picked per file by extension. The JS/JSX scanner tracks whether it is inside a
  single-quoted, double-quoted, or backtick string (honouring backslash escapes), only treats
  `/*`, `//`, and `<!--` as comment openers outside of one, and lets an unterminated comment run
  to end of input instead of throwing. The HTML scanner needed a second pass: JS and HTML
  disagree about what a quote character means, so reusing the JS scanner on markup meant an
  apostrophe in ordinary prose (`don't`) opened a string that never closed, silently hiding
  every comment and colour literal after it for the rest of the file. HTML mode now tracks a
  quote only while inside a tag's `<…>` span — an apostrophe in text content, or inside a
  `<style>` block's CSS, is just a character — while still stripping `<!-- … -->` and CSS's
  `/* … */` outside of an attribute value. The `colourLiteralsIn` table test grew nine cases
  across both modes that fail under the old single regex-pair implementation to pin this down.

## 0.24.0

### Minor Changes

- e1314fe: Every sweep now fails a shot whose page could not load one of its own assets.

  A pixel comparison structurally cannot catch a missing asset. A file the server
  does not have renders as a stable empty box, and a stable empty box compares
  equal to itself on every future run — so the moment a baseline records the empty
  state, the suite is green and wrong permanently, with nothing left to report it.
  This repo came within one run of exactly that: five `/brand` routes rendered in a
  job that never received `apps/docs/public/brand`, and the only reason it surfaced
  as a failure rather than a recording was that a correct baseline happened to have
  been minted first, by a differently-shaped job.

  `sweepPages`, `sweepStorybook` and `sweepChrome` now watch the network for
  same-origin responses of 400 or above and fail the shot before the screenshot is
  taken. Before, not after: CI mints a baseline for any shot that does not have
  one, so a check that ran after the capture would still let a first-shot route
  record its broken state as truth — which is the case worth preventing.

  Same-origin only, measured against `baseUrl`. A blanket rule would fail a suite
  whenever a third-party host a page legitimately reaches had a bad minute, which
  is a flake rather than a defect. Any status at or above 400 rather than 404
  alone, since a 500 paints the same empty box. Requests that fail without
  producing a response are deliberately not checked: a framework aborts its own
  route prefetches, and a genuinely absent file answers with a real status.

  A request expected to fail can be named in the new `allowMissing` option, as a
  substring or a `RegExp`. A page object that cannot be subscribed to is a hard
  error rather than a skipped check — a sweep that passes while watching nothing
  is indistinguishable from one with no missing assets, which is the failure this
  whole guard exists to make impossible.

## 0.23.0

### Minor Changes

- b0d68d7: Dense affordances are measured against a 24x24 floor instead of being exempted
  from measurement.

  `checkTouchTargets()` used to have two states for a control: measured against
  44x44, or not measured at all. `DENSE_AFFORDANCE_SELECTOR` and
  `data-touch-target="dense"` both did the second thing, so an 8x8 tap target
  carrying the attribute passed as cleanly as a 36px button did. There is now a
  third state, which is the one the contract always meant: **measured, against the
  dense floor.**

  That floor is 24x24 — WCAG 2.2 **AA**, SC 2.5.8 Target Size Minimum, and the
  `--target-min` token. 44x44 is AAA (SC 2.5.5) and this system's stricter
  default, which is what makes a second floor a relaxation to the standard rather
  than a discount off it. A dense control that misses 24x24 is reported under a
  new violation kind, `touch-target-dense`, and every violation now carries
  `contract` and `minimum` so the applied floor is readable without parsing the
  message.

  New exports: `MINIMUM_TOUCH_TARGET_DENSE` (24) and a `denseMinimum` option,
  clamped to `minimum` so a relaxation can never come out stricter than the floor
  it relaxes.

  **This is a breaking change for anyone running these checks.** A consumer who
  wrote `data-touch-target="dense"` on something under 24x24 has a green build
  that goes red on upgrade with no code change of their own. That is the intended
  effect — the attribute meant "stop looking" and now means "held to the
  standard's floor" — but it is an upgrade cost, and it is why this is a `minor`
  rather than a `patch`: on a 0.x package, `minor` is the breaking lane. It is not
  a `major` only because that would mint `1.0.0`, which is a claim about the
  package's overall API stability rather than about this change.

  There is deliberately **no `data-touch-target="none"` escape hatch.** 24x24 is
  the standard's own floor, so below it there is no principled number left to hold
  a control to; and a marker meaning "stop looking" is exactly the suppression
  habit this floor exists to end. The two cases that motivated the question are
  already answered by measurement: a control nothing routes to is reported as
  `touch-target-unmeasurable` rather than passing, and a control whose hit area
  lives on its `<label>` is measured on the label. A page with a genuine exception
  narrows `selector` or widens `exempt` at the call site, where it is visible in
  the test and gets reviewed.

  Two components move to keep the floor honest, and one token rule that was
  already meant to.
  - **`.ds-chip__remove` reaches 24x24 without repainting.** It was the one thing
    the system shipped under the floor: 22x22 painted, 22x22 effective, 2px short
    in both axes. The painted glyph stays 22px — MUI's own delete-icon scale — and
    the hit area now comes from a `--target-min`-sized `::after` centred on the
    control. Sized rather than negatively inset, so it is 24x24 in every condition
    including under `data-platform="mobile"`, and clears the chip label's centre by
    22px. `checkHitAreaOverlap()` reports nothing on it, asserted alongside the
    reach on both a normal and a one-character chip. The overlay is centred with
    negative margins rather than `transform: translate(-50%, -50%)`, so it creates
    no stacking context and hands nothing to the compositor: an overlay that
    changes how the glyph beneath it is rasterised is not a transparent overlay.
  - **The chip's remove glyph is drawn, not typed.** It rendered the literal
    character `×`, which made the control's appearance depend on a font — and on a
    `<button>`, on a font nobody declared: `font-family` is not inherited, the UA
    stylesheet sets it, so the glyph came out in the UA default beside a Geist
    label. Declaring the family fixed the typeface and not the geometry:
    `align-items: center` centres a text node's line _box_, and where the ink
    lands inside it is a property of the family's own metrics. Measured as painted
    pixels, the same declaration centred the UA default's `×` to 0.063px and
    Geist's to 0.875px — neither number designed, and `--font-sans` is a token a
    consumer may re-point, which would move it again.

    A new internal module, `lib/marks.tsx`, draws it as an inline SVG instead:
    `currentColor` so every existing colour state keeps working, `aria-hidden`
    because the button already has its accessible name, sized by a `--mark-size`
    custom property the control sets from the type ramp, and geometry symmetric
    about the viewBox's centre. It is a replaced element centred by the flex box
    the control already declares, so there is no baseline and no metric involved.
    **Measured after: 0.000px from the chip's painted centre, and 0.000px at every
    tenth of a pixel through a full pixel of layout nudging.** The mark paints
    6.75px of ink against the text glyph's 6.00px — deliberately a little
    stronger, and visible in the before/after shots.

    **This changes rendered output.** `Chip`'s remove affordance is a drawn cross
    rather than a typed character; its hit area, its 22px painted box, and every
    number in the touch-target tables are unchanged.

    `.ds-chip` keeps a declared `font-family` — its label is genuinely text, and
    `<button class="ds-chip">` was painting that label in the UA default while
    `<span class="ds-chip">` painted it in Geist.

  - **`.ds-table__sort` gets `min-height: var(--target-min)`.** It is the only
    element in the repo carrying `data-touch-target="dense"`, and it cleared 24 by
    0.45px of inline-box bleed over a 23.09px font-derived box with no
    `min-height` of its own. Stable across 40 subpixel/dpr permutations and still
    a rounding artefact: any header line-height change, or a consumer whose
    fallback font resolved differently, would have turned it red and looked like a
    contract regression. Painted height 23.09px → 24px.
  - **The two halves of the mobile touch floor now agree, and they agree by
    excluding the dense affordances rather than inflating them.** `tokens.css`
    floors controls to 44px twice — under `:root[data-platform="mobile"]` (0,2,1)
    and under `@media (max-width: 480px) and (pointer: coarse)`, which led with a
    bare `button` at (0,0,1) and _lost_ to `.ds-chip` and `.ds-button--sm` (0,1,0).
    So a responsive coarse-pointer phone got a 32px `button.ds-chip` and a 36px
    `--sm` button, while the same page with the attribute set got 44px for both — a
    real divergence between two rules whose own comment calls them "the same
    floor".

    Both halves now carry the same exclusion list, naming exactly the selectors in
    `DENSE_AFFORDANCE_SELECTOR`, so a control the contract measures against 24x24
    is no longer simultaneously stretched to 44px on a phone. A chip stays 32px and
    a `size="sm"` button stays 36px in every condition. Inflating them would have
    discarded the scale they were drawn at (MUI's Chip, shadcn's `sm`) and bought
    nothing the dense floor was not already buying — the dense tier is a
    measurement, not an exemption, and that is the whole premise of this release.

    **This changes rendered output under `data-platform="mobile"` and on
    coarse-pointer phones under 480px**: every dense affordance — a chip's remove
    glyph, a search field's clear, a rating star, a calendar day, a `--sm` button,
    and anything marked `data-touch-target="dense"` — keeps its own height there
    instead of being floored to 44px. Responsive rendering for a chip and a `--sm`
    button is unchanged from before this release; what changed is that the
    `data-platform="mobile"` half now matches it. The two halves are pinned to one
    another, and to `DENSE_AFFORDANCE_SELECTOR`, by tests that fail on drift.

  `.ds-chip` joins `DENSE_AFFORDANCE_SELECTOR`, which closes the separate finding
  that a chip which is a control — `<a class="ds-chip">`, `<button class="ds-chip">`,
  both sanctioned hand-written usages the React `<Chip>` cannot emit — was failing
  the 44px floor latently, for consumers only. 32px is MUI's Chip exactly, which is
  the reference scale this tier already cites, so "a chip is dense" was always the
  right answer; what made it unwritable was that adding it here used to mean
  _stopping measuring it_. Measured now: 64x32 and 63x32, clearing 24 comfortably.
  `Chip` gains no new API and is not resized.

## 0.22.0

### Minor Changes

- fda2027: The brand voice is Miltinson Technologies, and the royal-we rule is retired.

  `Never the royal "we."` was a hard rule in the brand README, and it travelled a long way:
  `brandVoice()` extracts the CONTENT FUNDAMENTALS section into `/llms-full.txt`, the packed skill
  artifact carries it, and the MCP server serves it from `miltinson://brand/voice` and
  `get_brand_guidance`. Every agent building against this system was told the copy must be first
  person singular.

  That is no longer the rule. The voice is Miltinson Technologies, and whether a product writes "I"
  or "we" is that product's decision, taken from what the product is — one name covers a single
  person's site and a company product, and both are the brand. "Eli speaks as himself" is now one
  legitimate instantiation rather than the rule itself. What replaces the prohibition is a
  consistency requirement: pick the person per product and hold it, because the tell of a voice
  nobody decided is one that switches partway down a page.

  Consumers pinned to the old wording will see it change in the corpus, the skill artifact, and the
  MCP resource. Nothing about the API moves.

  Refs #130.

## 0.21.0

### Minor Changes

- f86456a: Page sweeps can be clipped to a content region, and site chrome gets its own sweep.

  A site whose chrome derives from a registry — a sidebar built from a component list, a nav built from a page map — has a fan-out problem that a full-page sweep turns into noise: one added entry moves pixels on every page at once, so the suite reports one fact N times and every one of those baselines has to be accepted. This repo's own docs project was switched off for it.

  Two additions:
  - `sweepPages` takes `region`, a selector for the content element each page shot is clipped to. The chrome is then outside the frame, so it cannot fail a page shot — the fan-out is removed rather than suppressed. The capture stays a `fullPage` screenshot with a clip rather than an element screenshot, because Playwright scrolls an element into view before shooting it and a sticky header then paints over the top of the region.
  - `sweepChrome` shoots the pieces that left the frame — one test per region per theme, on one route — and names them in a route-shaped `/chrome/*` namespace so they map to a baseline path exactly as a page does.

  `regionBox` is exported alongside them. It throws when a selector matches no element, matches several, or matches one with no area: each of those would otherwise degrade into a shot that passes while comparing the wrong thing, or nothing.

  No behaviour changes for an existing caller — omitting `region` frames the whole page as before.

- a67b499: `defineVisualConfig` budgets 8 differing pixels for rasteriser nondeterminism, and keeps `threshold: 0`.

  The container pins software, not the host CPU. Skia's rasterisation of anti-aliased curves and glyph edges is not bit-identical across GitHub's runner fleet, and the measured case (issue #125) was a sweep going red on a commit that changed only `package.json` and `CHANGELOG.md` — 42 pixels differing byte-for-byte on two avatar arcs, 3 of them counted by the comparator, from a container digest identical to the passing runs either side of it.

  `threshold` stays at 0: a colour tolerance is what would hide a one-step shift inside a token ramp, and it is not on the table. The pixel budget is a different lever — a token-ramp shift, a spacing change, a font swap or a layout regression each move thousands of pixels and still fail at 8.

  `maxDiffPixelRatio` is now left unset rather than 0. Playwright resolves the two budgets with `Math.min`, so a ratio of 0 alongside `maxDiffPixels: 8` would have cancelled the budget back to 0 and made this change a no-op.

  Minor rather than patch: this is not a bug fix, it changes a shipped default in a way a consumer's suite will feel. A suite built on this preset now tolerates up to 8 differing pixels per shot where it previously tolerated none, and that is worth a version bump someone notices in a changelog. Overriding it is unchanged — `expect.toHaveScreenshot` still merges two levels deep, so `{ expect: { toHaveScreenshot: { maxDiffPixels: 0 } } }` restores the old behaviour and keeps the rest of the contract.

### Patch Changes

- c7e1c22: Stop the agent templates stating the copy rule's severity as a fact, and document
  `designSystem()`'s options where a consumer can reach them.

  `no-padded-ui-copy` ships at `warn`, and three of the four templates `ds init --agents`
  writes said so flatly — "`@elirobinson/eslint-config` warns on the literal phrases". For a
  repo that has taken the documented graduation step, `designSystem({ copy: { severity:
'error' } })`, that sentence is false, and it is not the consumer's to fix: the `AGENTS.md`
  copy lives inside the `design-system:begin/end` markers and the other three are whole-file
  writes, so `--force` discards any correction. All four now describe what the rule _reports_,
  name `warn` as the shipped default rather than as the effective level, and carry the raise —
  which also puts the graduation step on four surfaces instead of one.

  `patch` on `@elirobinson/ai-patterns`: `src/agents/*` and `src/patterns.md` are published
  files behind the `./agents/*` and `./patterns` exports, so `ds init --agents --force` and
  `pnpm ds patterns` print different text after this.

  `patch` on `@elirobinson/eslint-config`: the package had no README, so the option surface —
  including that `copy.severity` is destructured separately from the top-level `severity` and
  therefore does not inherit it — existed only as JSDoc a consumer reads by opening
  `node_modules`. The new README ships in the tarball and is what the registry page renders.
  No rule, option, or default changed.

- 5ab5370: Stop `checkHitAreaOverlap` reporting an `sr-only` sibling as a swallowed
  neighbour.

  The canonical `sr-only` element is `1px x 1px` — deliberately not `0x0`, because
  a genuinely zero-sized element is dropped from the accessibility tree in some
  browsers — and the check's only size guard was `rect.width === 0 || rect.height
=== 0`. It missed by exactly one pixel. Sitting at its control's static origin,
  such a label's centre lands on the control, so `elementFromPoint` returned the
  control and every accessible-name-only label came back as a violation: 23 pairs
  on a single consumer page, none of them actionable, and the message's advice
  ("bound the overlay") unfollowable for a control that has no overlay.

  Siblings that are not visually rendered are now skipped: `visibility: hidden`,
  `display: none`, `opacity: 0`, `clip-path: inset(50%)`, and — the general clause
  that covers every `sr-only` variant in the wild — anything measuring `1px` or
  less in both axes. A control that genuinely covers a _visible_ sibling is still
  reported.

- 8dc024f: Stop the browser test suites failing on teardown alone.

  `preflight-sweep.test.mjs` mirrored `playwright.test.mjs`'s browser bootstrap by
  hand and lost two things in the copy: the explicit budget on `afterAll`, which
  left `browser.close()` on Vitest's 10s default and failed the file roughly one
  run in three under load with all four of its tests already passing, and the
  loud skip, which meant a browser that never launched skipped the suite silently
  and orphaned a late-arriving Chromium.

  Both suites now boot from one `browser.test-helper.mjs`, which owns the budget
  and registers the teardown itself, so a suite cannot forget it. The helper is
  excluded from the published package. No consumer-facing behaviour changes; the
  `@elirobinson/tokens` bump is a comment in `link-cascade.test.mjs` that pointed
  at where the budget's reasoning used to live.

- bad5a02: Fix `checkTouchTargets` never measuring anything below the fold.

  `document.elementFromPoint` only answers for the visible viewport, and the hit
  probe never scrolled, so every probe on a control below the fold returned
  `null`. Originally that produced a literal `~1x1` violation on compliant
  controls — arithmetic from a failed probe rather than a measurement — and since
  the occlusion guard landed it produced silence instead: every primary control
  below the fold was skipped without ever being checked, so a genuinely undersized
  one passed. `expectDesignSystemContracts` was therefore only ever checking the
  first screenful of a page.

  Each surface is now scrolled into view before it is probed, its box re-read in
  the resulting coordinate space, and the page put back exactly where the check
  found it — window and scrollable containers both — so nothing downstream in the
  same test sees a moved page. A surface larger than the window cannot be walked
  to its edge, so it passes on its painted geometry instead of failing for being
  too big to probe. And a `null` from `elementFromPoint` is now distinguished from
  "something else is there": it is reported as `touch-target-unmeasurable`, a
  stated gap in the check, never as a size the check did not obtain.

## 0.20.0

### Minor Changes

- eee7c4f: Add `@elirobinson/ai-patterns/testing/preflight-sweep`, a detector for the class
  of bug where a component's rendering depends on a UA-stylesheet default that a
  consumer's CSS reset removes.

  `findPreflightSensitiveElements(page, { resetCss })` measures every element's
  box, applies the reset, measures again, and reports what moved. Both known
  instances of this bug shipped through CI green — the default comes from the UA
  stylesheet, so the component is correct in Storybook, correct in the docs app,
  and correct in jsdom (which does no layout at all), and wrong only with a reset
  loaded, which is the configuration every consumer ships.

  Consumers can point it at their own build with their own reset; a Tailwind
  consumer passes the contents of `tailwindcss/preflight.css`.

## 0.19.0

### Minor Changes

- 74c6645: Make the three dials queryable — a command, an MCP tool, and a roster you can import.

  The palette/theme/platform split shipped the dials but left them undiscoverable.
  Nothing you could run reported that `data-palette` or `data-platform` existed,
  `ds tokens` printed one value per token where four exist, and the MCP server
  answered for `ember/light` without saying so. The only way to learn the system
  had three dials was to read our stylesheets — which is prose you would have had
  to copy into your own docs, and wrong the day a third palette ships.

  ## `ds dials` — new

  ```
  $ ds dials

  DIALS  3 attributes on the root element; an absent attribute is the default

    palette   data-palette   ember (default)  slate
              40 tokens — the brand — neutral hue and chroma, --signal-*, --anchor-*, --accent*, --link*, --focus-ring

    theme     data-theme     light (default)  dark
              62 tokens — surfaces and text, and the re-picked value of everything the palette owns

    platform  data-platform  desktop (default)  mobile
              12 tokens — geometry only — radii, the small end of the type ramp, --gutter, the narrow containers. No colour.

  COMBINATIONS (4)  palette x theme — the dials that move colour
    ember/light  (no attributes — this is the default)
    ember/dark   data-theme="dark"
    slate/light  data-palette="slate"
    slate/dark   data-palette="slate" data-theme="dark"

  PLATFORM  data-platform="mobile" re-points 12 of 196 tokens, on top of all 4 combinations
    each row is the desktop value -> the mobile value

    --radius-sm     4px -> 8px
    --gutter        max(20px, round(4vw, 4px)) -> 16px
    ...
  ```

  Every row is derived from the installed package. Add a palette and this command
  reports it on a version bump, with nothing to edit.

  ## `ds tokens` reports every combination — BEHAVIOUR CHANGE

  A token that resolves the same everywhere still prints as one value. A token
  that does not now prints one labelled row per combination, and any token the
  platform layer re-points gets its override appended:

  ```
  $ ds tokens status-success

    --status-success            oklch(51.9% 0.145 150)
    --status-success-fg
      ember/light               oklch(44% 0.12 150)
      ember/dark                oklch(78% 0.13 150)
      slate/light               oklch(44% 0.12 150)
      slate/dark                oklch(78% 0.13 150)

  $ ds tokens radius-sm

    --radius-sm  4px
      [data-platform="mobile"]  8px
  ```

  Two things changed for anything parsing this output. Values are now **resolved**
  — a `var()` chain is followed to what it lands on, so `--accent` prints
  `oklch(72.5% 0.175 65)` rather than `var(--signal-500)`. And a varying token's
  values are indented under its name instead of sitting on the same line. If you
  scrape `ds tokens`, read `ds dials` first and expect both shapes.

  Against a `@elirobinson/tokens` older than this release, `ds tokens` prints what
  it always did plus a line naming the upgrade — it does not fail.

  ## MCP: `get_dials`, and `search_tokens` names its combination

  `get_dials` reports the roster, the combinations with the attributes that select
  each, and the platform overrides. `search_tokens` applies the same printing rule
  as the CLI and opens with the default combination, so an agent can no longer
  read a value without being told which combination it belongs to.

  Also fixed: `search_tokens` could not find `--scrim` or `--target`. The family
  matcher required a trailing hyphen, so both were missing from the `Prefixes:`
  list a failed search suggests — `{prefix: 'scrim'}` was a dead end with no way
  out, and `{prefix: 'target'}` returned `--target-min` and `--target-lg` but never
  `--target` itself. Both spellings now work.

  ## `@elirobinson/tokens/dials` — new export

  The roster as data, for anything that generates:

  ```js
  import { COMBINATIONS, DIALS, PALETTES, tokenDials } from '@elirobinson/tokens/dials';
  ```

  `DIALS`, `PALETTES`, `THEMES`, `PLATFORMS`, `COMBINATIONS`, `dialAttributeString()`
  for the attributes that select a selection, `platformOverrides()` for what a
  platform re-points, and `tokenDials()` for every token's value in every
  combination. There is still exactly one list — `PALETTES` in `./contrast` — and
  this re-exports it.

  If you keep your own palette switcher, theme provider, or token table, this is
  what it should read instead of a list of its own.

  ## Scaffolded apps can reach the dials

  `create-elirobinson-design-system` now writes a `lib/dials.ts` and a pre-paint
  bootstrap in the root layout, so a new app can render any combination instead of
  only `ember/light`. It ships the plumbing and **no switcher UI** — which dials a
  product exposes is a product decision. `lib/dials.ts` says where a switcher
  attaches.

  The bootstrap validates a stored palette against `PALETTES` from the roster, has
  no system fallback for brand (there is no `prefers-*` signal for it, and an
  absent attribute already means the default), and does both reads and both writes
  in a single `try` — split across two, a visitor who chose slate could be painted
  ember-dark on first paint when storage throws. `data-platform` is deliberately
  not written: `mobile.css` already carries a `@media (max-width: 480px) and
(pointer: coarse)` twin, which is the right mechanism for one document served to
  everything.

  ## Contracts

  `tier-boundary` no longer enumerates the tiers — it points at
  `@elirobinson/react/manifest`, whose `tiers` are read off the directory layout,
  and adds the rule for when something belongs in `ai/`. `minimumTouchTarget` now
  names `var(--target)`, `var(--target-min)` and `var(--target-lg)` rather than the
  literal `44x44`, which had been instructing consumers to write a hardcoded pixel
  value that the sibling `no-hardcoded-design-values` contract forbids and that
  `data-platform="mobile"` cannot re-point.

### Patch Changes

- 961cd60: Ship UI kit samples that lint clean in a consuming repo.

  `ds-resync artifacts --write` writes the kits into `.claude/skills/`, a
  directory most projects lint, where they produced 21 errors: 16
  `react/jsx-no-undef` for the five components `_shared/Primitives.jsx` defines,
  and 5 `no-undef` for `window`.

  The samples were not wrong — they load as classic `<script type="text/babel">`
  tags sharing one global scope, so there is nothing to import. They now say so,
  in the file, with a scoped `eslint-disable` for the one rule and a truthful
  `/* global window */`. Everything else about them is still linted, and only the
  kits that actually reference the shared primitives carry the disable, so
  `reportUnusedDisableDirectives` stays quiet.

- df6c46e: Stop the brand manifest scanners reading CSS comments as real dependencies.

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

## 0.18.1

### Patch Changes

- 8b40a99: Ship the 13 mirrored font assets that `npm pack` was dropping.

  `design-system-docs/fonts/` is a directory of symlinks into `packages/tokens/src/fonts/`, and `cpSync(..., { dereference: true })` only dereferences the copy _root_ — links met during the recursive walk were recreated as absolute, machine-specific links. `npm pack` drops a symlink pointing outside the package root, so all 13 font files were listed in `artifacts.json` and `brand-manifest.json` with valid hashes and absent from the tarball, and `ds-resync artifacts --write` failed with `ENOENT` on the first one.

  The build now materialises symlinks at every depth, asserts with `lstatSync().isFile()` that every path in `artifacts.json` is a regular file, and a new test packs the tarball and checks each shipped entry against its recorded hash.

- 73accac: `checkTouchTargets()` recognises `.ds-button--sm` as a compact variant.

  `.ds-button--sm` is 36px and `MINIMUM_TOUCH_TARGET` is 44, so the system's own
  small button failed the system's own `expectDesignSystemContracts()`. Neither
  remediation the error offered was correct: padding it to 44px turns an `sm` into
  an `md`, and hand-adding `data-touch-target="dense"` to a header CTA teaches
  consumers that the contract is something you silence. `sm` stays 36px and the
  contract now recognises it.

  Why the button rather than the contract moved:
  - WCAG 2.2 **AA** (SC 2.5.8, Target Size Minimum) asks for 24x24 CSS px. 44x44
    is **AAA** (SC 2.5.5). 36px clears AA with margin — it is under this system's
    stricter default, not under the standard. shadcn's own `sm` button is 36px.
  - Raised to 44px, `sm` would differ from `md` only in font size and horizontal
    padding — a typography variant, not a size variant. That deletes the reason
    `sm` exists, and anyone needing a compact control hand-rolls one outside the
    system instead.
  - The two-tier contract (`touch-target-primary` / `touch-target-dense`) was not
    wrong. The gap was that `size="sm"` had no way to declare which tier it is in.

  `.ds-button--sm` joins `DENSE_AFFORDANCE_SELECTOR`, so the exemption is keyed
  off the **class, not a React prop**. The failure reported in the wild was
  `a.ds-button.ds-button--accent.ds-button--sm` — an anchor carrying the classes,
  which `tokens.css` explicitly supports — so anything `Button.tsx` emitted for
  `size="sm"` would have missed it. Both `<Button size="sm">` and a hand-written
  `<a class="ds-button ds-button--sm">` now pass, and both are asserted against
  the shipped `Button.css` rather than a restated fixture.

  Nothing renders differently: 36px is still 36px, and no component or stylesheet
  changed. What changed is the contract, `contracts.json`'s `touch-target-primary`
  and `touch-target-dense` wording, and the violation message, which no longer
  points a consumer at `data-touch-target="dense"` as the only escape.

  The trade-off, recorded rather than solved: a consumer who uses `size="sm"` for
  a page's primary mobile action now gets a silent pass. Holding compact controls
  to a _dense floor_ (WCAG's 24x24) instead of exempting them from measurement is
  the answer to that, and is deliberately not built here.

## 0.18.0

### Minor Changes

- f549d48: Add `miltinson`, a third palette: teal over indigo.

  `data-palette="miltinson"` joins `ember` and `slate` on the palette dial. It is
  the brand miltinsons.com and the other Miltinson properties render in, moved
  onto the dial so those sites stop re-declaring `--accent*` in a local `:root`
  block that no contrast gate can see. Nothing about `ember` or `slate` changes,
  and an app that sets no `data-palette` is unaffected.

  The three teals those properties already ship are pinned to ramp steps rather
  than re-picked, so adopting the palette is a swap and not a redesign:

  | Step           | Value     | Was                       |
  | -------------- | --------- | ------------------------- |
  | `--signal-300` | `#5eead4` | `teal-light`              |
  | `--signal-500` | `#14b8a6` | `teal` — the resting fill |
  | `--signal-600` | `#0d9488` | `teal-dark`               |

  Structurally it follows `ember` rather than `slate`: `--accent` is the 500 step
  carrying `--ink-1000`, hover **lightens** to 400 and press darkens to 600. Teal
  peaks bright enough that the whole triad clears AA against its own fill in both
  themes — 8.44 / 11.10 / 5.61, the same three numbers in light and dark — which
  is what lets one `--accent-fg` serve both blocks. `slate` has to spend two
  different foregrounds on the same problem because its teal is deeper.

  `--anchor` is indigo, held about 90 degrees off the signal so a trust mark
  never reads as a muted CTA, and pulled toward the neutral hue so it sits on the
  greys rather than on top of them. `--anchor-400` is parked in the narrow band
  that clears 4.5:1 against both white and black (4.61 / 4.55), the same trick
  `slate` uses, which lets one step be the hover fill in light and the press fill
  in dark.

  ### The neutral dial is 252, not the properties' own 286

  Worth recording because it was measured rather than chosen. The properties'
  charcoal sits at hue 286, and a palette declaring `--n-h: 286` fails
  `contrast.test.mjs`: `--fg-2` measures 8.4490 under ember, 8.4485 under slate
  and 8.4798 under miltinson, a spread of 0.031 against a `PALETTE_TOLERANCE` of
  0.01. Lightness is untouched, but oklch chroma is not perfectly
  luminance-neutral in sRGB and a 39-degree rotation is far enough to show up in
  the second decimal.

  Lowering `--n-mult` does not rescue it — the spread is hue-dominated and barely
  responds. The passing band is roughly within 8 degrees of ember's 247, so the
  palette takes `--n-h: 252` (slate's hue) at `--n-mult: 1` (ember's chroma), for
  a spread of 0.004. At these chroma levels the difference between hue 252 and
  286 is well under one 8-bit unit per channel; the identity a consumer sees is
  carried by the teal and by the surfaces they pin themselves, not by the hue of
  a near-achromatic grey.

  ### Ratio comments in `palettes.css` are not gated

  Found while writing this: corrupting `--accent-ink`'s trailing `9.65:1` to
  `4.11:1` leaves all 675 token tests green, though `docs/agents/tokens.md` says
  a comment that drifts from its value is a failing build. That guarantee holds
  for the tokens the `CONTRAST_RULES` sweep names and not for the palette blocks'
  per-declaration comments. Every ratio in the new blocks was instead verified by
  re-resolving it through `combinationValues()` and `contrastRatio()`; four
  comments were off by 0.01–0.03 against the repo's own converter and were
  corrected. Closing the gap properly is worth its own change.

## 0.17.0

### Minor Changes

- 0f09b17: Ship the token migrations as a manifest and a command, instead of as prose.

  The palette release changes `--status-success` and `--status-warning`, makes
  `--fg-inverse` wrong on a status fill, requires a warning edge to be
  `--status-warning-border`, and demotes `--fg-on-signal` to a legacy alias. Until
  now the entire migration surface for that was the changelog: `ds-resync` printed
  the entries, and step 4 of its skill told an agent to "fix the call sites the
  breaking entries described". Every consuming repo re-derived the same find and
  replace by hand, from prose, every release — which is precisely the thing this
  repo says it will not ship.

  ## The manifest

  `@elirobinson/tokens` now ships `src/migrations.json`, exported as
  `@elirobinson/tokens/migrations` with its schema in `migrations.d.mts`. Each
  entry names the tokens it applies to, the version it landed in, the replacement
  if there is one, **the context that disambiguates it**, and the human reason:

  ```json
  {
    "id": "warning-needs-an-edge",
    "since": "0.9.0",
    "kind": "rename",
    "from": ["--status-warning"],
    "to": "--status-warning-border",
    "when": { "properties": ["border", "border-color", "outline-color", "…"] },
    "report": "occurrence",
    "reason": "--status-warning is 1.87:1 on --bg in light. …",
    "guidance": "Keep the fill. Move only the edge."
  }
  ```

  The `when` block is the whole point. `--status-warning` as a `background` is
  correct and must be left alone; the same token as a `border-color` has to move.
  An entry with no `when` applies everywhere; `blockMentions` plus
  `blockProperties` express "this text is drawn on a status fill" precisely enough
  to tell it apart from "a status token appears somewhere in this block".

  Four kinds, and only one of them is ever rewritten:

  | `kind`    | What it means                         | What happens          |
  | --------- | ------------------------------------- | --------------------- |
  | `rename`  | replaced by a differently-named token | rewritten, in context |
  | `repoint` | same name, different value            | reported              |
  | `review`  | still valid, wrong in this context    | reported              |
  | `removed` | gone, no replacement                  | reported              |

  ## The command

  ```bash
  pnpm --package=@elirobinson/ai-patterns dlx ds-resync migrate
  pnpm --package=@elirobinson/ai-patterns dlx ds-resync migrate --write
  ```

  Read-only until `--write`, the same as every other `ds-resync` command. It reads
  the manifest out of your `node_modules` — not out of `ds-resync` — so the
  migrations you get are the ones the version you just installed shipped with. The
  range comes from `.claude/ds-resync.json`, which `ds-resync --write` now leaves
  behind, so in the normal flow the command takes no arguments. `--from` and
  `--to` are there for a repo that upgraded some other way.

  **It refuses more than it rewrites, deliberately.** A token assigned to one of
  your own custom properties, a `borderColor` inside a ternary, a value whose name
  did not change — each is reported with a `why not` and a `use:` line and left
  exactly where it is. `bumpRange` in this same CLI has always returned null for a
  range it could not rewrite safely rather than guessing at your intent; this
  holds the same line over a much larger blast radius. There is no `--force`.

  `--fail-on-pending` exits 2 while anything is still left for a human.

  ## The manifest cannot go stale

  A migration manifest that drifts is worse than none, because the tooling built
  on it will be trusted. So it is not allowed to be the author's memory of what
  they changed. `packages/tokens` commits the previous token roster and
  `migrations.test.mjs` derives what actually moved between it and the stylesheets
  on disk; a token removed or repointed with no entry naming it fails the build,
  by name:

  ```
  1 token repointed with no migration entry:
    --status-success

  A consumer has these in their own CSS and TSX. Add an entry to migrations.json
  naming each one in its `from`, then accept the new roster with:
    node scripts/accept-token-baseline.mjs
  ```

  The other direction is checked too: a `to` naming a token that is not declared
  anywhere would have `--write` writing a dead variable into your stylesheet.

  ## Also in this release

  `@elirobinson/eslint-config` gains
  `@elirobinson-css/no-mismatched-status-foreground`, enabled by
  `designSystemCss()`. A changelog cannot reach your own stylesheets and a codemod
  only runs when you run it; a lint rule catches the same three defects every time
  anyone writes them again — a theme-flipping foreground on a status fill,
  `--status-warning` painting an edge, and `--fg-on-signal` in new code.

## 0.16.0

### Minor Changes

- 8938d09: Split the tokens into three composable dials, and take status and chart colours off the brand.

  `tokens.css` was one file that hardcoded one brand. It is now three layers
  selected by three independent attributes on the root element:

  | Dial     | Attribute                     | Owns                                                                                   |
  | -------- | ----------------------------- | -------------------------------------------------------------------------------------- |
  | Palette  | `data-palette="ember\|slate"` | neutral hue/chroma, `--signal-*`, `--anchor-*`, `--accent*`, `--link*`, `--focus-ring` |
  | Theme    | `data-theme="light\|dark"`    | surfaces, and the re-picked values of all of the above                                 |
  | Platform | `data-platform="mobile"`      | radii, type floors, `--gutter`, control min-height                                     |

  `ember` is the default and its ramps are unchanged, so a consumer that sets no
  attribute renders almost exactly what it rendered before. The exceptions are
  real and are the two sections marked BREAKING below: the status colours moved
  off the brand, and a warning fill now has to be edged.

  ## Migration

  ### 1. Nothing to do for the new files

  `tokens.css` now `@import`s two siblings, `palettes.css` and `mobile.css`.
  Both ship in the package and both are in the `exports` map. If you import the
  stylesheet the normal way there is nothing to change:

  ```css
  @import '@elirobinson/tokens/tokens.css';
  ```

  **But** if your build copies `tokens.css` to a static directory, inlines it, or
  serves it from somewhere the two siblings are not, the imports dangle and the
  page renders with no colour at all. Copy `palettes.css` and `mobile.css`
  alongside it, or flatten the imports. Anything that reads the stylesheet as
  _data_ (a token table, a docs page, a script) must now read both files:

  ```js
  import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
  import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';

  // before: parseTokensCss(readFileSync('…/tokens.css', 'utf8'))
  const tokens = parseTokensCss(readTokenStylesheets(srcDir));
  ```

  `parseTokensCss` accepts an array now. Reading `tokens.css` alone does not
  throw — it silently returns a roster with no brand in it.

  ### 2. `--status-success` and `--status-warning` changed colour — BREAKING

  Status used to be made of brand. `--status-success` was `--anchor-500`
  (forest) and `--status-warning` was `--signal-600` — _the same amber as the
  primary CTA_, so a caution badge sat next to an accent button in the identical
  colour. Both now own their own hue and neither moves with the palette.

  | Token              | Was                   | Is now                   | Measured on `--bg`             |
  | ------------------ | --------------------- | ------------------------ | ------------------------------ |
  | `--status-success` | `var(--anchor-500)`   | `oklch(51.9% 0.145 150)` | 5.17:1 light, 4.06:1 dark      |
  | `--status-warning` | `var(--signal-600)`   | `oklch(80.25% 0.16 85)`  | **1.87:1** light, 11.22:1 dark |
  | `--status-danger`  | `oklch(58% 0.22 25)`  | `oklch(54.85% 0.2 27)`   | 5.41:1 light, 3.88:1 dark      |
  | `--status-info`    | `oklch(60% 0.13 240)` | `oklch(54% 0.155 250)`   | 5.06:1 light, 4.15:1 dark      |

  If you were relying on success being forest green or warning being brand
  amber — for instance to make a badge match a button — that is the coupling
  this change removes. Use `--anchor` or `--accent` explicitly if you wanted the
  brand colour; use the status token if you wanted the status.

  ### 3. A warning fill or rule must now be edged — BREAKING

  `--status-warning` is **1.87:1** and cannot be drawn bare. Yellow that clears
  3:1 on white is olive, which is not a caution colour, so the floor is carried
  by a separate token:

  ```css
  /* before */
  .my-callout {
    border-color: var(--status-warning);
  }

  /* after */
  .my-callout {
    border-color: var(--status-warning-border);
  } /* 3.76:1 light, 11.22:1 dark */
  ```

  Every place you paint `--status-warning` as a stripe, a rule, a dot or a fill
  edge, swap in `--status-warning-border`. The fill itself is still
  `--status-warning`, but it needs the border around it. This is the only status
  state with the asymmetry — success, danger and info clear 3:1 as bare fills in
  both themes.

  ### 4. Two new members per status state

  Each state now has five tokens instead of three:
  - `--status-X` — the fill. Never text.
  - `--status-X-on` — **new**, the text drawn _on_ that fill. 5.17 / 11.22 / 5.41 / 5.06.
  - `--status-X-fg` — status text on `--bg` / `--surface`.
  - `--status-X-tint` — the quiet panel background.
  - `--status-X-tint-edge` — **new**, that panel's hairline.

  If you were drawing a label on a status fill and reaching for `--fg-inverse`
  or `--fg-on-signal`, replace it with `--status-X-on`.

  Neither of the old choices can be right in both themes, because both move
  while the fill under them does not. `--fg-inverse` is white in light and black
  in dark; on the previous token set that already failed two cells —
  `text-info-foreground` on `bg-info` at **3.88:1** in light, and
  `text-destructive-foreground` on `bg-destructive` at **4.38:1** in dark. With
  the status hues re-picked in this release it would have failed three different
  cells instead (success 4.06, danger 3.88, info 4.15, all in dark) while fixing
  light — trading one theme's failures for the other's.

  `--fg-on-signal` is the second half and was latent rather than live: it
  resolves to `--accent-fg`, which is ink under `ember` and white under `slate`,
  so a warning label on the 1.87:1 yellow fill drops to **1.87:1** as soon as a
  second palette exists. One palette hid it.

  `--status-X-on` is the token measured against the fill it is drawn on, and it
  holds at 5.17 / 11.22 / 5.41 / 5.06 in all four palette x theme combinations.
  The Tailwind bridge's `--color-*-foreground` aliases are repointed to it, so
  if you use `text-success-foreground`, `text-warning-foreground`,
  `text-destructive-foreground` or `text-info-foreground`, their rendered colour
  changes and the pairing now holds in every cell.

  If you use `bg-*-tint`, `border-*-tint-edge` is the hairline that goes with it.

  ### 5. New: eight categorical chart colours

  `--chart-1` … `--chart-8`, plus `--chart-grid` and `--chart-axis`. Eight hues
  at one lightness and one chroma so no series shouts louder than another,
  ordered so consecutive slots are at least 90° apart. Palette-independent: a
  chart does not restyle itself when the brand does. Light 3.34–3.90:1 (fills
  and strokes only), dark 8.61–9.59:1 (which also clears 4.5:1 for in-chart
  labels). A legend still needs a label or a shape — colour is never the only
  channel (SC 1.4.1). Tailwind: `bg-chart-1` … `text-chart-8`.

  ### 6. New: targets, safe areas, scrim

  `--target-min: 24px` (the SC 2.5.8 floor), `--target: 44px`,
  `--target-lg: 56px`; `--safe-t` / `-r` / `-b` / `-l` reading `env(safe-area-inset-*)`;
  and `--scrim` for the wash behind a modal (0.56 light, 0.72 dark). Tailwind
  gets `min-h-target`, `size-target-min`, `bg-scrim`. The safe-area tokens are
  deliberately not aliased into a utility — an inset is added to an existing
  pad, not substituted for it, so write
  `pb-[calc(var(--space-4)+var(--safe-b))]`.

  `[data-platform="mobile"]` raises every `button`, `[role="button"]`,
  `a.ds-button`, `input:not([type='range'])` and `select` to 44px, and coarsens
  radii and the small end of the type ramp. It changes **no colour**, so every
  measured ratio still holds on a phone.

  ### 7. `--n-h` / `--n-mult`, and where a token override goes

  The neutral ramp is mixed from two palette-owned dials —
  `oklch(<L>% calc(<C> * var(--n-mult)) var(--n-h))`. Lightness is untouched by
  either, and lightness is what carries contrast, so a palette can take the greys
  from near-achromatic to charcoal without moving a measured neutral ratio. That
  is asserted, not assumed: across every neutral foreground on every neutral
  surface in both themes, the largest disagreement between the two palettes is
  0.003:1, which is two orders of magnitude below the gap between any two WCAG
  thresholds. If you have your own greys, this is the mechanism to copy — put
  them on the same two dials rather than declaring a second ramp.

  If you override tokens in your own `:root`, note that `palettes.css` and
  `mobile.css` are `@import`ed _before_ `tokens.css`'s own declarations, and a
  bare `[data-*]` selector ties with `:root` at (0,1,0). Your own unlayered
  `:root` block still wins over all of it, as before. But if you were overriding
  a brand token by re-declaring the ramp step it points at, point at the
  semantic token instead — the ramps are the palette's now.

  ### 8. `::selection` and `--fg-on-signal`

  `::selection` hardcoded `--signal-500` with ink text, which is amber under
  every palette and the wrong foreground under half of them. It is
  `var(--accent)` / `var(--accent-fg)` now. `--fg-on-signal` is kept as a
  documented alias of `--accent-fg`; new code should use `--accent-fg`.

  ## Verification

  `contrast.test.mjs` now sweeps **palette × theme** — four combinations, not
  two — and asserts three things a two-theme sweep could not see: that every
  `--status-*` and `--chart-*` resolves identically under both palettes, that
  every neutral measures identically under both, and that no block declares a
  token under a selector the resolver does not understand. The two un-inverted
  brand tints (`--accent-tint` / `--anchor-tint` sat at the `50` step in dark
  mode, a 97%-light chip on a black page) are fixed and would now fail the
  build. The exception for `--status-warning` is written into `CONTRAST_RULES`'
  `except` map with its reason and is asserted from both sides: the fill under
  3:1, and `--status-warning-border` over it.

## 0.15.2

### Patch Changes

- 92587b1: Add six components for decision and assistant surfaces, and a new `ai` tier.

  They were designed and proven in a product built on this system, where every one of them
  had been hand-built because the library had no equivalent. Everything below is additive —
  no existing component, class, or token changed, so upgrading needs no migration. What
  follows is how to adopt them.

  ## New imports

  There is no barrel; each component is its own subpath.

  ```tsx
  import { ChatThread } from '@elirobinson/react/components/ai/ChatThread';
  import { ChatMessage } from '@elirobinson/react/components/ai/ChatMessage';
  import { StreamingCaret } from '@elirobinson/react/components/ai/StreamingCaret';
  import { VerdictBadge } from '@elirobinson/react/components/molecules/VerdictBadge';
  import { StubCard } from '@elirobinson/react/components/molecules/StubCard';
  import { DecisionCard } from '@elirobinson/react/components/organisms/DecisionCard';
  ```

  `ai/` is a **new tier directory**. If your app imports the aggregate
  `@elirobinson/react/styles.css` you already have their styles. If you import per-component
  sheets instead, add these:

  ```css
  @import '@elirobinson/react/styles/ai/ChatThread.css';
  @import '@elirobinson/react/styles/ai/ChatMessage.css';
  @import '@elirobinson/react/styles/ai/StreamingCaret.css';
  @import '@elirobinson/react/styles/molecules/VerdictBadge.css';
  @import '@elirobinson/react/styles/molecules/StubCard.css';
  @import '@elirobinson/react/styles/organisms/DecisionCard.css';
  ```

  If you keep your own list of tiers anywhere — a codegen script, a docs sidebar, a lint
  rule — it now needs `ai` alongside `atoms`, `molecules`, `organisms`. Better: read
  `@elirobinson/react/manifest`, whose `tiers` array is derived from the directory layout
  and already contains it.

  ## Required props, so a first render does not fail

  These are the props with no default. Everything else is optional.
  - `ChatThread` — **`label`** (string). The accessible name of the log region. There is no
    copy inside the component, so this is not optional and there is no fallback.
  - `ChatMessage` — **`avatar`** (node). Required on purpose: there is no role-derived
    avatar. Pass a glyph, an initial, or an `<img>`. `variant` is `'sent' | 'received'` and
    defaults to `'received'`.
  - `VerdictBadge` — **`verdict`** (`'go' | 'no' | 'hold'`) and **`label`** (string, the
    word). The glyph is supplied per verdict and can be overridden with `glyph`.
  - `StubCard` — **`title`**, **`items`** (`{ label, value }[]`), **`stubLabel`**,
    **`stubValue`**.
  - `DecisionCard` — **`verdict`**, **`verdictLabel`**, **`headline`**.

  If you are migrating a hand-built chat surface, note that `ChatMessage` takes `actions` as
  a **node**, not an `[{ label, onClick }]` array, and has no `citations` prop. Render your
  own controls into `actions`.

  ## `DecisionCard` renders no footer when there is no action

  This is a product guarantee, not a style choice, and adopting `DecisionCard` means
  adopting it: when the `action` prop is absent, the component renders **no
  `.ds-decision__foot` element at all** — not a disabled button, not a hidden one, nothing.
  The card is structurally incapable of showing a payment control under a negative verdict.
  Pass `closing` to give that verdict its last word; it renders in the body.

  Two consequences for a consumer:
  - Do not pass `action={<Button disabled />}` to represent "no action available". Omit
    `action` entirely. Passing a disabled node re-creates exactly the failure the guarantee
    exists to prevent.
  - Any CSS or test of yours that assumes `.ds-decision__foot` is always present will not
    match on a card without an action. Query it conditionally.

  `StreamingCaret` has the sibling rule: `active={false}` returns `null` rather than
  rendering a hidden element, so it cannot be left mounted on a finished message. Drive it
  from the same state that decides whether the stream is still running.

  ## Opting into the product token layer (optional)

  All six read an optional `--product-*` layer, and every read falls back to a system token,
  so doing nothing keeps the Miltinson defaults and full contrast coverage. To give your
  product its own signal without forking the token set:
  1. Copy `docs/agents/tokens.product-layer.css` from the design-system repo into your app
     and import it **after** `@elirobinson/react/styles.css`.
  2. Put `data-product="<your-app>"` on the subtree your product owns — your app shell, not
     `<html>`.
  3. Re-point only the variables you actually own:
     `--product-signal` (a non-text state graphic, needs 3:1), `--product-signal-fg` (brand
     colour a user reads), and the three verdict pairs `--product-verdict-{go,no,hold}` with
     their `-fg` counterparts.

  Two rules that will bite otherwise. **Override a fill and its foreground together** — a
  verdict pair is two variables for one decision, and re-pointing only the fill is how a
  light tint ends up carrying light text in dark mode. And **write dark overrides as
  descendant selectors** (`[data-theme='dark'] [data-product]`, plus `.dark [data-product]`
  for class-strategy switchers), because the theme attribute normally sits on `<html>`,
  above your product scope — `[data-product][data-theme='dark']` matches nothing.

  Full reference: `docs/agents/product-token-layer.md`.

  ## Also in this release

  `@elirobinson/ai-patterns`: the brand manifest gains a `component-card` category for
  component specimen cards, and the design-project build no longer treats `ChatMessage` and
  `ChatThread` as project-owned components now that the package ships them.

## 0.15.1

### Patch Changes

- d9391af: Visual regression: the `docs-wide` Playwright project is temporarily disabled.

  This is repo CI, not published behaviour — no consumer API changes. A consuming
  repo using `@elirobinson/ai-patterns/testing/visual-config` is unaffected: the
  preset still exports `WIDE_VIEWPORT` and `NARROW_VIEWPORT`, and which projects
  you run has always been yours to declare in your own `playwright.config.ts`.

  If you mirror this repo's project list, note the reasoning: the docs sidebar
  renders on every page and derives from one registry, so adding a single
  component invalidates every wide-viewport page shot at once — 142 of them on
  PR #88, against zero story failures. A per-page suite whose failures are all
  the same one bit is noise on exactly the pull requests it should be protecting.
  Component-isolating story shots carry the real signal.

## 0.15.0

### Minor Changes

- 72eb10e: Ship the control-edge contrast rule instead of describing it.

  `--border` (1.24:1 against `--bg`) and `--border-strong` (1.53:1) are
  decorative on purpose — card seams, table rules, dividers, the edge of a
  floating panel. `--border-control` (3.64:1 light, 3.95:1 dark) is the edge that
  tells a user where an input, switch, chip, slider, stepper or segmented control
  is, which SC 1.4.11 asks to clear 3:1. Both tokens measure correctly on their
  own, so a per-token contrast sweep cannot see the mistake: it is a stylesheet
  reaching for the wrong one. Inside this repo `component-css.test.mjs` has swept
  for it for a while. A consuming app's own stylesheets had nothing but prose.

  **What a consumer must do**
  1. If you already use the CSS entry point, the rule turns on by itself — it is
     added to the config `designSystemCss()` returns, at whatever `severity` you
     already pass. Just run your lint:

     ```bash
     pnpm eslint .
     ```

     Every new `@elirobinson-css/no-decorative-control-edge` error names the
     selector, the declaration and the token it found.

  2. If you are not linting CSS yet, add the entry point (it needs `@eslint/css`,
     which is why it is separate):

     ```js
     // eslint.config.mjs
     import designSystem from '@elirobinson/eslint-config';
     import designSystemCss from '@elirobinson/eslint-config/css';

     export default [...designSystem(), ...designSystemCss()];
     ```

     Point it away from any stylesheet that _defines_ values rather than consuming
     them — your own token layer, vendored CSS — with
     `designSystemCss({ ignores: ['src/styles/tokens.css'] })`.

  3. Fix each hit by swapping the token on that declaration. The find/replace is
     mechanical once you have the list:

     ```
     border: 1px solid var(--border)         →  border: 1px solid var(--border-control)
     border-color: var(--border-strong)      →  border-color: var(--border-control)
     ```

     Tailwind users: `border-border` → `border-control` on a control. `border-input`
     already resolves to `--border-control`, so an input using it needs no change.

  4. If a flagged selector is genuinely decorative — a floating panel a widget
     opens, an outline badge, a rule under a tab strip — keep the decorative token
     and silence that one line, rather than widening the ignore list:

     ```css
     /* eslint-disable-next-line @elirobinson-css/no-decorative-control-edge */
     border: 1px solid var(--border);
     ```

     The test to apply: if the border were invisible, would the user lose the
     control? Then it is `--border-control`.

  **Scope, so you know what will and will not fire**

  The rule matches a selector that reads as a control on whole words — `btn`,
  `button`, `cta`, `chip`, `action`, `pagination`, `segmented`, `input`, `field`,
  `select`, `textarea`, `switch`, `toggle`, `checkbox`, `radio`, `slider`,
  `stepper`, `search`, `kbd`, `trigger` — plus the `button`/`input`/`select`/
  `textarea` elements and the matching `type=`/`role=` attributes. It is
  deliberately narrower than `no-underlined-control-label`: a badge or a tab strip
  paints a fill, so an underline inside it is a defect, but its border is trim.
  Only colour-bearing border properties are checked, so `border-radius` and
  `border-width` are never flagged, and only `var(--border)` / `var(--border-strong)`
  are — a hardcoded `#ddd` is `no-hardcoded-design-values`' job.

  **Also in this release**

  `@elirobinson/ai-patterns/contracts` gains a `control-edge-contrast` entry under
  `componentConstraints`, so an agent working in your repo gets the constraint,
  its check and what verifies it without reading anyone's docs.

## 0.14.0

### Minor Changes

- 64f3f58: Measure the surface that actually takes the click. Closes #65.

  Running the published browser contracts against this repo's own components for
  the first time produced 62 touch-target and 2 focus-visible findings across 84
  stories in both themes. Four of the 62 were real. The rest were the checks
  measuring the wrong element, and every one of them reaches consumers.

  **`DENSE_AFFORDANCE_SELECTOR` named a glyph, not a control.** It listed
  `.ds-rating__star`, which Rating puts on the `<span>` inside the button — the
  control is `button.ds-rating__button`. The documented exemption had never
  matched anything, so the affordance the contract explicitly carves out was
  failing the contract. `.ds-calendar__day` went the same way for a different
  reason: there is no Calendar component, and an exemption that outlives its
  reason is how a sweep goes quiet. Both are now asserted against markup rather
  than against the string, because a class list is only as good as the elements it
  lands on.

  **A form control's hit area is not always the control.** A `<label>` forwards
  its clicks, so in the standard "18x18 native input, real text label" pairing the
  label is what a finger goes for, and measuring the box measures something nobody
  aims at. `checkTouchTargets` now passes a control when either its own hit area
  or a single label that activates it clears 44x44. It has to be one surface: an
  input and a label 12px apart do not add up to one 44px target, and treating them
  as if they did would pass every checkbox ever written. An unlabelled 18x18
  checkbox still fails, and so does one whose label is a 20px sliver of text.

  **Controls nothing routes to are no longer reported as 1x1.** The reach walk
  starts at ±1px and never tested the centre, so it could not tell "tiny" from
  "occluded". With a modal `<dialog>` open Chromium attributes hits over the
  `::backdrop` to the dialog, so every control behind it measured 1x1 — an
  untouched 186x44 button was told to add padding, which would have done nothing.
  `checkFocusVisible` had the mirror of the same bug: focus is refused on an inert
  control, the snapshots match trivially, and a control with a perfectly good ring
  was reported as missing one. Both now skip what they cannot validly measure.
  Any consumer page with an open `Dialog`, `Sheet` or `CommandPalette` was hitting
  this.

  `TouchTargetViolation` gains optional `labelWidth` / `labelHeight`, reported
  when a label was considered and was also too small, so the message says what was
  measured instead of leaving the reader to wonder why the label next door did not
  rescue an 18x18 box.

  **In `@elirobinson/react`, the components that were measuring wrong now carry
  the hit area they always appeared to have**, with no change to a single painted
  pixel — verified by screenshotting all 84 stories in both themes before and
  after:
  - `Checkbox`, `Switch` and `RadioGroup` make the row itself the `<label>`
    instead of wrapping one in a `<div>`. The 44px row was already there; a div
    just forwarded nothing. Radio needed it twice over — option text as short as
    "Ash" measured 28x23, so even a full-height text label would not have reached
    44px wide, while the row with the input and gap does.
  - `Breadcrumb` links and `RuleLink` get bounded overlays. Both are nav items, so
    the 44px rule applies rather than the dense scale, but padding would have
    spaced out the trail and pushed RuleLink's underline — which is the
    component's whole identity — down the page. The overlays give the same 44x44 a
    finger needs and move nothing, bounded so they cannot reach a neighbour's
    centre.
  - The table sort toggle declares `data-touch-target="dense"`. It is grid chrome
    inside a header cell, the same family as the chip remove and the calendar day,
    and its 24px hit area is the WCAG 2.2 AA floor; taking it to 44 would mean a
    44px-tall header row on every table in the system. Declared on the element
    rather than added to `DENSE_AFFORDANCE_SELECTOR`, which is what that list's
    own documentation asks for.

  That leaves one finding, deliberately unfixed: `.ds-button--sm` has an 89x36 hit
  area. `contracts.json` names buttons as primary controls needing 44x44, and 36px
  is exactly shadcn's `size="sm"`, so the variant cannot satisfy the rule and stay
  a small button. Exempting it would say buttons are exempt from the button rule.
  It is left failing for a deliberate decision rather than settled quietly here.

- 64f3f58: Ship the visual regression suite as a preset instead of something to copy.
  - New `@elirobinson/ai-patterns/testing/visual-config`: `defineVisualConfig` returns the
    determinism contract a screenshot suite has to hold — pinned clock, locale and timezone,
    `animations: 'disabled'`, exact pixel comparison (`threshold: 0`, and both diff budgets at
    zero), no retries, and `updateSnapshots: 'none'` so Playwright's default never quietly
    writes a baseline nobody asked for. `assertContainedBaselineUpdate` refuses
    `--update-snapshots` outside the pinned container, which is what stops a laptop's font
    rendering from becoming the baseline everyone else fails against. `use` and `expect` merge
    two levels deep, so setting one option there cannot silently drop the contract beneath it.
  - New `@elirobinson/ai-patterns/testing/visual-sweep`: `sweepStorybook` and `sweepPages`
    register one test per subject per theme — theming, settling, caret suppression and the
    capture itself included — and `storybookStories` / `nextStaticRoutes` enumerate those
    subjects from a build's own `index.json` and prerender manifest. There is no list of
    components to snapshot anywhere, in this repo or a consumer's: adding a story or a page is
    all it takes to get a baseline.
  - Both are plain `.mjs` with hand-written types, resolvable from CommonJS, and take
    Playwright's `test` and `expect` as arguments rather than importing them, so
    `@playwright/test` stays an optional peer.

## 0.13.0

### Minor Changes

- 5a36a91: A control no longer gets to dress up as a link. `@elirobinson/eslint-config/css` gains
  `no-underlined-control-label`: a rule that paints a control's own filled surface and also
  declares `text-decoration: underline` is an error, because an underline is the one visual
  signal a hyperlink owns and a reader cannot tell a button wearing it from a link. A
  link-styled button on no fill, and a link that happens to sit on a fill, are both
  deliberate patterns and stay silent.

  The matching `componentConstraints` entry ships in `@elirobinson/ai-patterns`' contracts,
  with its `verifiedBy` naming the lint rule and the two `@elirobinson/react` tests that pin
  the same property inside the system.

  No token values changed, and no component changed: `.ds-button` already dropped the
  underline in every variant. This is the guard that keeps it that way.

### Patch Changes

- 056ba51: Derive the brand skill's file inventory from what the tarball actually contains.

  The consumer copies of `README.md` and `SKILL.md` listed the skill's files from
  `BRAND_INDEX`, a hand-kept array in `src/artifacts/brand.mjs`. It named the four
  `ui_kits/<kit>/` folders and missed `ui_kits/_shared/`, so every consumer
  received `Primitives.jsx` — the file all four kits load over
  `../_shared/Primitives.jsx` — with no document mentioning it, and a kit copied
  out on the strength of the inventory rendered nothing.

  The rows now come from the files the packer stages, at full depth.
  `BRAND_DESCRIPTIONS` holds only the editorial one-liner per row, and the build
  fails on a shipped folder with no row **and** on a row with no files behind it.
  The check it replaces compared first path segments only, which is why `ui_kits`
  being described four times over was enough to hide a fifth folder from it.

## 0.12.2

### Patch Changes

- ef18f53: Drop the stray chat screenshot from the shipped brand manifest. `uploads/pasted-1777227214382-0.png` was pasted working material, not brand material, but the `@elirobinson/ai-patterns/brand-manifest` export (`dist/artifacts/brand-manifest.json`, published in `dist`) carried an entry for it under `category: "scratch"`. That entry is gone; a `.gitkeep` entry (same `category: "scratch"`, `origin: "incidental"`, `ships: false`) takes its place so the directory stays present for the manifest generator without tracking pasted files.

## 0.12.1

### Patch Changes

- 0917a4d: Self-host Geist and JetBrains Mono. `tokens.css` no longer reaches Google Fonts through a render-blocking remote `@import` — it `@import`s a package-local `fonts.css` that declares `@font-face` over woff2 files shipped in the package (both families are SIL OFL 1.1; licenses included). Importing `@elirobinson/tokens/tokens.css` is enough: bundlers inline the import and emit the font assets, a plain `<link>` resolves it relatively, and no request leaves the consumer's origin. Consumers that stripped the remote import and self-hosted via `@fontsource-variable/*` (plus `--ds-font-*-override` pointing at those families) can delete that wiring. The `@elirobinson/ai-patterns` brand skill ships the same faces alongside `colors_and_type.css`, so its `@import './fonts.css'` resolves in a consumer's `.claude/skills/` too.

## 0.12.0

### Minor Changes

- 32f76d2: Add the **UI Copy Is Chrome** rule, and ship a lint rule for the literal half of it.

  Functional copy — errors, empty states, helper and hint text, toasts, labels,
  button text, tooltips, confirmations, validation — is chrome. It states the fact,
  then the consequence, then the action, and stops. The rule names the six ways
  that gets padded into marketing: unverifiable frequency claims ("almost always"),
  blame attribution ("on their side", "check your connection"), filler pacing ("in
  a moment", "hang tight"), unprompted reassurance or apology ("don't worry",
  "we'll sort it out"), escalation paths nobody asked for, and enthusiasm ("Great
  news!", exclamation marks). Reassurance is allowed only where it answers a
  question the reader is actually asking, and only as a fact: "You have not been
  charged." Past two short sentences, functional copy is explaining, reassuring, or
  selling.

  **The rule governs chrome, never a product's editorial voice**, and that
  distinction is repeated everywhere the rule appears rather than stated once.
  Marketing prose, conversational surfaces, and written deliverables are content;
  their voice is a deliberate design decision and this says nothing about them.
  Read as an instruction to write plainly everywhere, the rule does more harm than
  the padding it removes — which is why it is worth writing down instead of leaving
  to taste.

  Where it now lives, so a consumer picks it up by upgrading:
  - **`pnpm ds patterns`** — as principle 6, and as a line in the **Definition of
    Done for UI work**, which is the checklist agents are told to work before
    calling UI done.
  - **`pnpm ds contracts`** — a new `ui-copy` constraint with its own `check` and
    `verifiedBy`.
  - **All four agent templates** written by `ds init --agents` (`AGENTS.md`'s
    managed block, the Claude Code skill, the Cursor rule, the Copilot
    instructions), so the next `init` carries it into every consuming repo.
  - **`pnpm ds prompts audit-page`** — a seventh check, with editorial content
    explicitly out of scope and wording changes moved to report-don't-fix.

  **New ESLint rule: `@elirobinson/no-padded-ui-copy`**, matching those phrases
  literally. Its scope is the content/chrome line encoded in code rather than left
  to a heuristic: it reads copy props (`title`, `description`, `label`,
  `placeholder`, `helperText`, `error`, `tooltip`, `aria-label`, …) and the
  children of chrome components (`Alert`, `Toast`, `Tooltip`, `Callout`, `Banner`,
  `EmptyState`, `FormMessage`, …). It never reads arbitrary JSX text, so a landing
  page's prose is untouched by construction. The cost is that chrome in an
  unrecognised component is missed, which is the right way round — a rule that
  flagged a product's voice would be switched off within a day.

  **It ships as a warning, not an error.** Every repo upgrading into this has copy
  written before the rule existed, and a hard error on upgrade would block them.
  Raise it once that copy is clean:

  ```js
  export default [...designSystem({ copy: { severity: 'error' } })];
  ```

  `components`, `props` and `allow` options extend or exempt; `severity: 'off'`
  switches it off. The two-sentence limit and the content/chrome judgement stay
  review, not lint — a length check would fire on legitimately long confirmations
  and teach people to disable the rule.

  This repo holds itself to it at `error` across `packages/react` and the docs app,
  which report zero findings today.

## 0.11.0

### Minor Changes

- 242fbe0: The llms corpus gains a brand layer: `llmsFull` accepts an optional `brand` input and renders the voice rules from the brand README (extracted loudly — a missing CONTENT FUNDAMENTALS section throws) plus the kit and asset inventory. The packed snapshot carries only `ships: true` artifacts; a corpus that includes repo-only artifacts gets them marked as such. An agent asked to build a Miltinson page previously got prop tables and tokens and no voice guidance at all.
- 242fbe0: Add `@elirobinson/ai-patterns/brand-manifest`: one record per artifact in `design-system-docs/`, with category, origin (generated cards are identified by importing `buildGuidelineCards`, never a hardcoded list), ships/shipReason derived from `BRAND_SOURCES`, per-artifact render facts (dependencies as written, external origins through the stylesheet chain, viewports), and member roles. The in-repo `design-system-docs/README.md` index table is now generated from it between the managed markers — fixing the phantom `templates/` row, the fifth slide template that never existed, and the auth surface the webapp kit does not export, and adding the six top-level entries the hand-kept table omitted.
- 242fbe0: Two additive surfaces for the MCP server: `@elirobinson/ai-patterns` exports `./adherence` (the generated adherence-config builder) and `./brand-readme` (the packed brand README the voice rules are extracted from), and `@elirobinson/eslint-config` exports `mcpStdio(files)` — a flat-config block for packages that serve MCP over stdio, where a single `console.log` corrupts the JSON-RPC channel: `no-console` at error severity, `console.error` only.

## 0.10.0

### Minor Changes

- 43e1b92: Measure `ds-resync` staleness against the lockfile, and report an out-of-sync `node_modules` as its own finding.

  `ds-resync` decided whether a repo was current by comparing `node_modules`
  against the registry. It never read the lockfile. When an install had drifted
  ahead of the committed manifests, the tool reported the repo as nearly current
  while the state CI and a fresh clone actually build was many versions behind —
  silently, with no indication that the two sources disagreed.

  Observed in a consuming repo: `package.json` asked for `@elirobinson/react`
  `^1.3.0`, the lockfile held 1.3.0, and `node_modules` held 2.0.1. `ds-resync`
  printed "1 package behind: @elirobinson/ai-patterns 0.9.0 → 0.9.2 (patch)". The
  truth was four packages behind, including a major on `react`.

  **What the tool compares now.** The version the lockfile resolved — what CI and
  a fresh clone install — against the registry. `pnpm-lock.yaml`,
  `package-lock.json` and `yarn.lock` are all read, so this is not pnpm-only. With
  no lockfile entry the declared range's floor stands in, and the report says so
  rather than passing it off as a resolved version.

  **A new finding, reported first.** When `node_modules` disagrees with the
  lockfile, the report opens with `NODE_MODULES OUT OF SYNC`, naming both versions
  per package. It is deliberately not the same condition as "behind": the fix is
  an install, not an upgrade. It shows in the default read-only run, and
  `--fail-on-out-of-sync` exits 2 on it in CI. That flag is independent of
  `--fail-on-outdated` — neither trips the other — and is named apart from
  `ds-resync artifacts --fail-on-drift`, which is about the generated snapshot.

  **`elirobinson-ds` now warns too.** Discovery still reads `node_modules`; that
  design is correct and unchanged. But while an install has drifted, `ds` and
  `ds props <Name>` describe an API that is installed here and is not what CI
  builds — the exact path by which an agent writes code that passes locally and
  fails on merge. It now prints a one-line caution to **stderr** when installed
  and locked disagree. stdout is untouched, so anything parsing that output is
  unaffected, and the exit code does not change.

  **What changes for a consumer parsing `--json`.** The per-package baseline is
  now `currentVersion`, with `currentSource` recording whether it came from the
  `lockfile`, a declared `range`, or was `unresolved`. `installedVersion` still
  exists but now means only what is in `node_modules` — it is no longer the
  comparison baseline, and it can be `null`. `lockedVersion` is new, as is a
  top-level `drift` array. Anything reading `installedVersion` as "the version
  this repo is on" should read `currentVersion` instead.

  Also fixes a latent crash: a `workspace:*` dependency resolves to `link:…` in
  the lockfile and its range holds no version, which threw `Unparseable version`
  and produced no output at all. Those packages are now reported as not compared.

## 0.9.2

### Patch Changes

- 4da857a: Fix every documented `dlx` invocation of this package's binaries.

  This package ships two bins, `ds-resync` and `elirobinson-ds`. `pnpm dlx <pkg> <bin>`
  only resolves for a single-bin package — the trailing word is parsed as an argument to
  the implied binary, not as a selector — so every documented entry point aborted with
  `ERR_PNPM_DLX_MULTIPLE_BINS` before our code was spawned. The working form names the
  package explicitly:

  ```bash
  pnpm --package=@elirobinson/ai-patterns dlx ds-resync artifacts --write
  ```

  `RESYNC_COMMAND` held the broken string and is interpolated into the llms corpus and into
  the generated `SKILL.md`, so `ds-resync artifacts --write` wrote a command that cannot run
  into every consuming repo's `.claude/skills/`, and the design-system-reference corpus told
  agents to run it. Re-run `ds-resync artifacts --write` after upgrading to pick up the
  corrected text.

  **Why this is a patch and not a minor.** `RESYNC_COMMAND`'s value changes and a new `DLX`
  constant is exported, which would normally read as a minor. But the old value names a
  command that cannot execute: any consumer depending on it was already broken, there is no
  working behaviour to preserve, and there is nothing to migrate. The change only removes a
  failure.

  Also in this release:
  - New export `DLX` from `@elirobinson/ai-patterns/corpus` — the invocation prefix, as one
    constant. `RESYNC_COMMAND` derives from it, and the stale-snapshot warning imports it
    rather than hardcoding a copy.
  - `src/artifacts/dlx.test.mjs` executes the documented command for both bins in a scratch
    directory and asserts a zero exit — the check that would have caught this, which an
    assertion on the string alone would not — and fails the build if the bare form reappears
    in any tracked file outside the changelogs and the dated plans under `docs/superpowers/`.
    That guard is what protects the Markdown surfaces, which cannot import a constant.

## 0.9.1

### Patch Changes

- 7cd6a82: Generate the Claude Design project's API contract, foundation cards and skill docs.

  The design project carried hand-maintained restatements of this repo — an oxlint
  config describing the component API, and swatch cards enumerating the token
  scale — and both had drifted. The config described a flat prop surface where
  `@elirobinson/react` is compound (it put `Sheet`'s `side` on `Sheet` rather than
  `SheetContent`, exported a `ToastViewport` that does not exist, and invented
  seven child components), and the ink card rendered 10 of the 13 `--ink-*` steps.

  Three generators now derive those artifacts from sources that cannot drift —
  `@elirobinson/react/manifest` and `tokens.css` — reached through a new
  `build:design-project` script. They are internal to this repo: none is added to
  the package's `exports`, so nothing new is importable by a consumer.

  **What changes for a consumer.** The `miltinson-design` skill written by
  `ds-resync artifacts` has one paragraph in a different place. The sentence
  naming the tokens stylesheet and the readme is now inside the managed block
  rather than below it, because the three surfaces that carry this skill spell
  those files differently and the paragraph has to be generated per surface
  instead of shared verbatim. The wording and the brand rules are unchanged; only
  the block boundary moved. Re-run `ds-resync artifacts` to pick it up — the hash
  check will report `SKILL.md` as changed.

## 0.9.0

### Minor Changes

- b11ae1b: Give the font families a supported override hook, and write down the cascade
  rule that made overriding a token guesswork.

  Adopting the Tailwind bridge in a `next/font` app silently dropped the brand
  typeface: the page rendered in the system font and nothing errored. Two causes,
  both ours.

  **`@elirobinson/tokens`**
  - `--font-sans`, `--font-display` and `--font-mono` now read a
    `--ds-font-*-override` before their own stack:

    ```css
    :root {
      --ds-font-sans-override: var(--font-geist-sans);
      --ds-font-mono-override: var(--font-geist-mono);
    }
    ```

    `next/font` never exposes a family under its real name — it generates one and
    hands it over in a CSS variable — so the literal `'Geist'` matched nothing the
    app had loaded and `body`, every `.t-*` class and the `font-sans` utility fell
    through to `ui-sans-serif`. Purely additive: an unset override resolves to the
    exact stack that shipped before, so nothing changes for existing consumers.
    Scoped to the three families, because a family is the only token whose value
    the framework legitimately owns at runtime.

  - **`tokens.css` is unlayered, by design, and that is now documented.**
    Unlayered declarations beat anything inside a cascade layer whatever the
    order, so an override written inside `@layer base` — the conventional place in
    a Next.js `globals.css`, and where the docs implied it belonged — silently
    loses. Overrides go in a plain `:root` block. The `--ds-font-*-override` hooks
    are exempt: the stylesheet declares them nowhere, so they apply from any
    layer.
  - `parse-tokens-css` resolves a `var()`'s fallback when the property it names is
    undeclared, the way a browser does, and no longer reads a declaration written
    inside a comment as a token. Without the first, every consumer of the parsed
    token set — `tokens.json`, `ds tokens`, the docs foundations pages, the llms
    snapshot — would have started reporting a raw `var()` for the three families.

  **`@elirobinson/ai-patterns`**
  - `patterns.md` gains a third _Integration note_ alongside the `next-themes`
    selector and the Tailwind bridge — the same species of silent failure —
    including the `<html>` vs `<body>` detail: `--font-geist-sans` has to be
    defined at `:root` for the override to resolve.
  - The `adopt-system` prompt and all four agent instruction templates carry the
    cascade rule and the font hook.
  - `ds tokens` keeps agreeing with the shared parser on comments and on values
    Prettier wrapped across lines.

## 0.8.0

### Minor Changes

- 4fb7251: Resolve `@elirobinson/ai-patterns/corpus` from CommonJS, and declare the Node
  floor that makes it work.

  `./corpus` exported only an `import` condition — the same latent bug
  `./testing/playwright` had, found while fixing that one and left out of scope
  there. The caller that renders its own `llms.txt` from its own manifest is a
  build script, and a build script in a `"type": "commonjs"` repo is a plain `.js`
  file, so it reaches this subpath through `require` and died on
  `ERR_PACKAGE_PATH_NOT_EXPORTED` at resolution, before `llmsIndex` was ever
  called. The only working form was `.mjs`, which nothing said — and a subpath a
  consumer has to be told how to import is prose we made them write.

  The `require` condition points at the same `llms.mjs` the `import` condition
  does, rather than at a new CJS build. The module imports nothing at all and
  holds no state — every export is a pure function of its arguments — so pointing
  both conditions at one file also rules out a dual-package split, and
  `packages/ai-patterns` keeps shipping plain files. That leans on Node's
  `require(esm)`, which needs the module to be free of top-level await (it is,
  across an empty dependency graph) and a runtime of 22.12 or newer — hence the
  new `"engines": { "node": ">=22.12.0" }`, which the package previously left
  implied.

  `llms.exports.test.mjs` pins both halves: it resolves the subpath under the
  `require` condition through Node's real export-map resolution, and it actually
  `require()`s the module, so either deleting the condition or introducing a
  top-level await fails here rather than in a consumer's build.

## 0.7.0

### Minor Changes

- 36097a8: Resolve `@elirobinson/ai-patterns/testing/playwright` from CommonJS, and declare
  the Node floor that makes it work.

  `./testing/playwright` exported only an `import` condition. Playwright compiles a
  plain `.ts` spec to CommonJS, so the spec the README documents resolved through
  `require` and died on `ERR_PACKAGE_PATH_NOT_EXPORTED` before a single assertion
  ran. The only working form was a `.spec.mts` file, which nothing said.

  The `require` condition points at the same `playwright.mjs` the `import`
  condition does, rather than at a new CJS build. Nothing in the module needs
  transpiling, it holds no state — every export is a pure function over a `page` —
  so pointing both conditions at one file also rules out a dual-package split, and
  `packages/ai-patterns` keeps shipping plain files. That leans on Node's
  `require(esm)`, which needs the module to be free of top-level await (it is: the
  one `await import('axe-core')` is inside `checkContrast`) and a runtime of 22.12
  or newer — hence the new `"engines": { "node": ">=22.12.0" }`, which the package
  previously left implied.

  `playwright.exports.test.mjs` pins both halves: it resolves the subpath under the
  `require` condition through Node's real export-map resolution, and it actually
  `require()`s the module, so either deleting the condition or adding a top-level
  await fails here rather than in a consumer's E2E suite.

  The README example keeps its `.ts` filename — now accurate — and gains one line
  naming the Node floor and the `.spec.mts` fallback below it.

## 0.6.0

### Minor Changes

- 2c3c5e7: One llms corpus generator, owned by `@elirobinson/ai-patterns`.

  The generator that renders `llms.txt` and `llms-full.txt` existed twice, written
  independently and producing the same format: once in `apps/docs` for the live
  `/llms.txt` routes, once in this package for the snapshot that ships in the
  tarball. `INTRO` and the import rules were duplicated character for character;
  the prop tables, component sections, and index were reimplemented. Both files
  opened with a comment asserting the other was its twin, which is not a mechanism
  — they had already drifted.

  There is now one implementation, published as `@elirobinson/ai-patterns/corpus`
  (`llmsIndex`, `llmsFull`, `versionStamp`, `RESYNC_COMMAND`), with a hand-written
  `llms.d.ts` and a drift test against it, matching how `./testing/playwright` is
  published. It is parameterized by the four things that genuinely differ between
  the two callers, each optional and absent by default:
  - `versions` — stamps the output as a snapshot. The docs site passes none.
  - `prose` — the Foundations and Patterns pages, as plain markdown.
  - `componentAppendix` — extra blocks per component section; the docs site
    appends the page prose and a `/r/<slug>.json` link.
  - `alsoAvailable` — the "what else is here" bullets, which are URLs on a website
    and filenames plus a CLI in a tarball.

  The packed snapshot is byte-identical to what it produced before, and so is the
  docs `/llms.txt`. Two docs outputs change, both deliberately:
  - `/llms-full.txt` gains exactly one trailing newline, so neither a file nor a
    `text/plain` body ends mid-line. Nothing else in it moves.
  - `/r/<slug>.json` spreads the manifest record, so its `importPath` key is now
    `importSpecifier` — the same rename described below, surfacing on the one
    machine-readable route that isn't a corpus.

  Two fixes that only became possible once there was one reader:
  - Component order is driven off `manifest.tiers` rather than a hardcoded
    `['atoms', 'molecules', 'organisms']` in each copy. A tier added to
    `@elirobinson/react` used to drop every component in it out of the corpus
    silently; it now appears, and a component the manifest gives no tier is
    emitted after the tiers rather than discarded.
  - `@elirobinson/react`'s manifest drops `importPath`, which was a byte-identical
    alias of `importSpecifier` published only so the docs site and the `ds` CLI
    could each keep their own name for it. `importSpecifier` is the one name.

  Removing a published manifest field is breaking, so `@elirobinson/react` is
  marked `major`. It is already taking a `major` in this batch, and the field
  being removed was introduced in this same unreleased batch, so no released
  reader ever saw it — but the manifest is a published contract and the bump
  should say what happened to it rather than what it cost.

- c6cfaa0: Make `tokens.css` the only place the token set is written down.

  **`@elirobinson/tokens`**
  - `tokens.json` is now generated from `tokens.css` at build time. The
    hand-maintained file had drifted to 95 leaf values against 151 `:root` custom
    properties — `--signal-200/300/400/600/800/900` and
    `--anchor-200/300/400/600/800/900` were missing entirely, with nothing marking
    the file as partial. All 151 are now present. The nested shape and every key
    that existed before are unchanged, so `@elirobinson/tokens/tokens-data` and
    `@elirobinson/tokens/tokens.json` keep working; 62 leaves were added.
    Values are now copied verbatim out of the stylesheet, so a few that the
    hand-written file had padded change spelling without changing meaning
    (`oklch(86.0% …)` → `oklch(86% …)`).
  - New export `@elirobinson/tokens/parse-tokens-css` — the one CSS token parser,
    previously duplicated in three places across the monorepo.
  - The package has tests for the first time, including one that fails if
    `tokens.json` stops covering every `:root` custom property.

  **`@elirobinson/ai-patterns`**
  - The `colors_and_type.css` shipped into `.claude/skills/miltinson-design/` is
    now the tokens package's own `tokens.css` rather than a hand-kept sibling of
    it. The two had diverged: the copy consumers received was missing the `.dark`
    compatibility selector and the dark-mode `--focus-ring` override, so every
    `outline: 2px solid var(--focus-ring)` was black-on-black in dark mode — a
    silent failure of the `focusVisibleRequired` contract.
  - `ds tokens` now reads only `:root` and, when a token is declared twice, prints
    the declaration CSS actually applies. `--status-success` and
    `--status-warning` are re-pointed at brand colors after the base scale
    declares them, so they previously printed the shadowed value.

### Patch Changes

- cc6dd9d: Add a drift test for the published `testing/playwright` type surface.

  `src/testing/playwright.mjs` is plain JavaScript typed by a hand-written
  `playwright.d.ts`, and `./testing/playwright` publishes both as `types` and
  `import`. Nothing checked that the two agreed, so a rename or a new helper could
  leave the declarations describing a module that no longer exists — invisible in
  this repo, and surfacing only when a consumer's test suite compiles against the
  lie.

  `playwright.types.test.mjs` compares the module's real runtime exports against
  the value declarations parsed out of the `.d.ts` in both directions, and names
  the specific export that drifted in the failure message. No new dependencies.

  Also updates the `no-barrel-imports` check text in `contracts.json`, which
  enumerates the legal `@elirobinson/*` subpaths, to say `styles/*.css` rather
  than `styles/*` — `@elirobinson/react` v2 narrows that export, and the shipped
  contract must not advertise a pattern that no longer resolves.

- 98839c4: Internal: `ds-resync` parses both commands' flags through one table-driven parser instead of two hand-rolled else-if chains, so a flag both commands should honour can no longer land on only one. No change to flag names, defaults, or error messages.
- c476af3: Internal: `ds-resync` generates both commands' `Options:` help from the same flag table it parses with, and the argument handling moved out of `cli.mjs` into a sibling `args.mjs`. Adding a flag is now one edit rather than a table entry plus a matching usage block. The rendered help text is byte-identical, pinned by a test.
- b393053: One component manifest, owned by `@elirobinson/react`.

  `./manifest` now carries everything the two extractors used to produce
  separately. Alongside the existing `name` / `tier` / `subpath` /
  `importSpecifier` / `exports` / `types` / `propsType` / `variants`, every
  component record gains `slug`, `description`, `props` (full prop tables with
  types, defaults, required flags, and per-prop JSDoc), `subComponents`, `hooks`,
  `inherits`, `stylesheetPaths`, `constraints`, and `extractionGaps`; hook records
  gain `description`. `manifestVersion` is `2`. `./manifest` also gains a `types`
  condition, so it is a typed import rather than an `any`.

  `minor` rather than `major`: every v1 field keeps its name and its meaning, so a
  v1 reader keeps working. Three things do change, none of them a v1 field:
  - `inherits` now names bases the previous regex-based extractor gave up on
    (`Table`, `VirtualList`, `VirtualTable`, `Accordion` said `null` and now name
    the type they extend).
  - `organisms/table/core`, which exports helpers `Table` and `VirtualTable`
    share rather than a component of its own name, is no longer listed as a
    component. It was never importable as one, and the types it exports
    (`ColumnDef` and friends) are re-exported from `Table`.
  - The docs-side record's `exportedTypes` is not carried over under that name —
    `types`, which the manifest already published, is the same list derived from
    the AST rather than a regex, and a superset of it.

  Descriptions for components whose source carries no JSDoc still come from a
  curated fallback list, which moved with the extractor to
  `packages/react/scripts/component-descriptions.json`. It moved rather than being
  replaced because removing it means writing JSDoc on 44 components in
  `packages/react/src`, which this change deliberately does not touch; its header
  now says out loud that every entry in it is debt.

  `@elirobinson/ai-patterns` is a `patch`: its published output is unchanged, but
  `build-artifacts.mjs` now reads `@elirobinson/react/manifest` instead of a
  generated file inside `apps/docs`, so producing the tarball no longer depends on
  a documentation app.

## 0.5.0

### Minor Changes

- 68d5273: **Fixes `ds-resync` never running when installed.** Since it shipped in 0.4.0, the CLI
  detected whether it was the entry point by checking that `process.argv[1]` ended in
  `cli.mjs`. npm installs a bin as a symlink, so Node reports `.bin/ds-resync` there and the
  check never matched — the command exited 0 having done nothing, on every install. If you
  ran `ds-resync` against 0.4.0 and it appeared to succeed, it did not run; re-run it on this
  version. Entry-point detection now resolves the real path, and a test spawns the CLI
  through a symlink so this cannot regress.

  `ds-resync artifacts` syncs the design system's agent guidance into a consuming repo.
  Three skills land under `.claude/skills/`: the Miltinson brand skill, a version-stamped
  component reference (`llms.txt` / `llms-full.txt` covering every component, prop table,
  token, and machine-checkable constraint), and the `ds-resync` instructions themselves.
  Read-only by default; `--write` applies.

  The package now has a real build/`prepack` step that stages all of it into the tarball,
  so none of this depends on a docs site that is not deployed anywhere. The `/llms-full.txt`
  URLs in `resync/skill`, `prompts/audit-page`, and `prompts/add-component` — which never
  resolved — now point at what actually ships.

  Re-running is safe by construction. Every file written is recorded with its sha256 in
  `.claude/ds-artifacts.json`; a file that still matches is updated, and a file you have
  edited is left exactly as you left it and named in the report. `--force` takes the shipped
  copy instead.

  Each artifact carries the `@elirobinson/react` version it was generated against, and the
  command warns loudly when that is not the version the repo has installed — a snapshot that
  silently describes a different release is how an agent ends up with confidently wrong prop
  tables. `--fail-on-drift` turns that into exit 2 for CI.

## 0.4.0

### Minor Changes

- 8c7d56b: Make the contracts executable and ship the agent-instruction surfaces.
  - New `@elirobinson/ai-patterns/testing/playwright`: `checkTouchTargets`,
    `checkHitAreaOverlap`, `checkFocusVisible`, `checkContrast` and
    `expectDesignSystemContracts` for the `uiContracts` only a browser can settle. Touch
    targets are measured as the _effective_ hit area, so a small glyph expanded with padding
    or a bounded overlay passes. `@playwright/test` and `axe-core` are optional peers.
  - New `@elirobinson/ai-patterns/agents/*`: a Claude Code skill, a Cursor rule, Copilot
    instructions, and an `AGENTS.md` block, installed by `ds init --agents`. None of them
    contains an inventory — they point at `ds`. The `AGENTS.md` fragment merges between
    markers so a consumer's own content survives a re-run.
  - `contracts.json` gains a `verifiedBy` for every entry, naming the lint rule or test
    helper that enforces it — or saying plainly that it is review-only. Two constraints the
    system always implied are now stated: `no-foreign-component-libraries` and
    `no-hardcoded-design-values`. Existing keys keep their existing types;
    `uiContracts.verifiedBy` is a sibling map, so `uiContracts.minimumTouchTarget` is still
    the string `"44x44"`.
  - `patterns.md` gains **Discover, Don't Document** and **Definition of Done for UI work**,
    plus integration notes for the two traps that fail silently: `next-themes` defaulting to
    a `class` strategy the stylesheet never looks at, and Tailwind utilities resolving to
    nothing without the token bridge.
  - The `adopt-system` prompt now starts by wiring up the tooling — CLI, ESLint config,
    Tailwind bridge, agent files, contract tests — before migrating any screen.

- 8c7d56b: Ship the `elirobinson-ds` discovery CLI as a `bin`, so agents and humans ask the installed
  packages what exists instead of trusting a doc.

  Consumers reduce to one package.json line — `"ds": "elirobinson-ds"` — and get `ds`,
  `ds props <Name>`, `ds tokens [filter]`, `ds classes [filter]`, `ds contracts`,
  `ds patterns`, `ds prompts [name]` and `ds init --agents`. Discovery walks the installed
  package tree rather than assuming a directory structure, so the same command describes a
  flat 0.x layout and a tiered 1.x one; it reads `@elirobinson/react`'s new `manifest.json`
  and falls back to parsing emitted declarations on older installs. A missing package
  produces an instruction naming what to install.

  It works from an install (`pnpm ds`, `pnpm exec elirobinson-ds`) or straight from the
  registry (`pnpm dlx @elirobinson/ai-patterns elirobinson-ds`). In the `dlx` case the binary
  is absent from the project's own `node_modules`, so it falls back to its own package root
  for contracts, patterns and prompts rather than reporting itself as not installed.

- a82dcc9: Add `ds-resync`, a command for bringing a consuming repo's `@elirobinson/*` packages up to
  date. A bare run reports current versus latest per package along with the changelog entries
  in between; `--write` rewrites the ranges and installs.

  `@elirobinson/react` and `@elirobinson/tokens` now ship `CHANGELOG.md` in their published
  tarballs, which is what makes the migration notes readable from a consuming repo.

- a6f2796: `ds-resync` can now upgrade a subset of packages, each to a chosen distance. `--only`
  restricts the run to named packages, `--target` picks how far to jump (`latest`, `minor`,
  or `patch`, globally or per package), and `-i` walks the choices interactively.

  This exists for the case that actually blocks an upgrade: a breaking major you are not
  ready for should not cost you the fixes below it. The report names any version held back
  so the deferred migration stays visible.

## 0.3.0

### Minor Changes

- 96092e7: Add prompt templates and extend the machine-checkable contracts.

  Three prompt templates ship under `./prompts/*` (new export): adding a
  component to the system, adopting the system in an existing app, and
  auditing a page for token/accessibility compliance. Each follows the
  existing `patterns.md` house style — intent, constraints, verification
  checklist — and is rendered on the new documentation site's "Build with
  AI" page.

  `contracts.json` gains a `componentConstraints` block so the constraints
  that previously lived only in prose (`docs/agents/components.md`) are
  machine-checkable: the scoped touch-target policy, the `forwardRef`
  requirement, the tier boundary rule, and the no-barrel-imports import
  convention. All existing keys (`systemPromptStyle`, `uiContracts`) are
  unchanged.

## 0.2.0

### Minor Changes

- 52b1b6d: Remove root barrel exports. Import token data from `@elirobinson/tokens/tokens-data` and AI patterns from `@elirobinson/ai-patterns/patterns` or `./contracts`.

## 0.1.1

### Patch Changes

- 60e0c53: Publish design system packages to the GitHub Packages npm registry.
