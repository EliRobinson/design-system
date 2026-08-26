# @elirobinson/eslint-config

## 0.8.1

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

## 0.8.0

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

## 0.7.0

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

## 0.6.0

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

## 0.5.0

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

## 0.4.0

### Minor Changes

- 242fbe0: Two additive surfaces for the MCP server: `@elirobinson/ai-patterns` exports `./adherence` (the generated adherence-config builder) and `./brand-readme` (the packed brand README the voice rules are extracted from), and `@elirobinson/eslint-config` exports `mcpStdio(files)` — a flat-config block for packages that serve MCP over stdio, where a single `console.log` corrupts the JSON-RPC channel: `no-console` at error severity, `console.error` only.

## 0.3.0

### Minor Changes

- c9843d4: no-hardcoded-design-values: the JS/JSX and CSS rules now share one definition of which **property** belongs to which axis — colour, radius, shadow or motion.

  The previous release shared what counts as a hardcoded _value_ and left the property half per-language: a camelCase `Set` in the JS rule, a kebab-case regex in the CSS one. Those had drifted the same way the regexes had. `filter: drop-shadow(0 4px 8px #000)` was an error in a `.tsx` style object and silent in a `.css` file, and `text-shadow: 0 0 rgb(0 0 0 / .5)` reported a _colour_ in CSS and a _shadow_ in JS, because the CSS colour pattern also matched the shadow properties and the two rules tested their branches in a different order.

  Both rules now read the axis from one table in `value-patterns.mjs`, written once in the JS spelling with the CSS spelling derived from it. A property belongs to exactly one axis — building the lookups throws if one is listed twice — so the branch-order question disappears. A parity test walks the table and asserts both spellings resolve to the same axis, so a future divergence fails the suite.

  Reconciling the divergences changes what both rules flag. No option schema changed, and no message text changed.

  **CSS — new errors:**
  - `filter` and `backdrop-filter` are now on the shadow axis, so `filter: drop-shadow(0 4px 8px #000)` is flagged (it always was in JS).
  - `column-rule-color` is now flagged as a colour (it always was in JS).
  - The two-segment logical border colours — `border-block-start-color`, `border-block-end-color`, `border-inline-start-color`, `border-inline-end-color` — are now flagged. The old regex allowed only one segment, so it caught `border-block-color` but not `border-block-start-color`.

  **CSS — changed message id:** a `box-shadow` or `text-shadow` whose only literal is a colour, with no length to go with it (`text-shadow: 0 0 rgb(0 0 0 / .5)`), now reports `shadow` instead of `color`. Those properties are on the shadow axis and nowhere else; the advice to reach for a shadow token is the more actionable of the two. Values that already carried a length (`0 4px 12px rgba(0,0,0,.1)`) reported `shadow` before and still do. If you suppress this with an inline disable naming the message id, update it.

  **JS/JSX — new errors:** the logical border colours (`borderBlockColor`, `borderInlineStartColor`, …) and logical radii (`borderStartStartRadius`, `borderStartEndRadius`, `borderEndStartRadius`, `borderEndEndRadius`) are now flagged. The CSS regex already covered most of these; the JS `Set` listed only the physical properties.

  **JS/JSX — fewer errors:** `filter` and `backdropFilter` only count as a shadow when the value actually carries a `drop-shadow()`. `filter: 'blur(4px)'` was reported as a hardcoded shadow and told to use `shadow-md`, which is not the advice for a blur radius. `filter: 'drop-shadow(...) blur(2px)'` is still flagged.

  **Both — fewer errors, in theory:** the CSS property patterns were regexes that also matched properties that do not exist (`border-anything-color`, `border-anything-radius`). The axis table lists the real properties instead. No valid stylesheet loses coverage.

- c9843d4: no-hardcoded-design-values: the JS/JSX and CSS rules now share one definition of what a hardcoded **value** is.

  Both rules kept private copies of the same regexes and exemption list, and the copies had drifted — most visibly, `color(display-p3 1 0 0)` was an error in a `.tsx` style object and silent in a `.css` file. They now import a single `value-patterns.mjs`, and a parity test asserts value handling in both languages so a future divergence there fails the suite. (Which _property_ belongs to which axis is still decided per language and can still drift; that half is untouched.)

  Reconciling the divergences changes which code the **CSS** rule flags. No option schema or message id changed, and the JS/JSX rule flags exactly what it flagged before.
  - **New errors:** `color()` is now recognised as a colour function in CSS, so `color: color(display-p3 1 0 0)` is flagged (it always was in JS). If your stylesheets use wide-gamut literals, expect new errors — point `ignores` at the stylesheet that legitimately defines them, or move the literal into a custom property.
  - **Fewer errors:** an explicit zero (`border-radius: 0px`) is no longer flagged in CSS — zero is not a design decision, and the JS rule never flagged it.
  - **Fewer errors:** Tailwind's `theme(...)` now counts as a token reference in CSS as it already did in JS. Like `var(--…)`, it exempts the whole declaration it appears in, so `box-shadow: 0 1px 2px theme(--color-slate-200)` passes — and so does a compound value that mixes it with a literal, e.g. `transition: color 200ms theme(--ease)`.
  - **No visible change:** `revert` is now exempt in JS as it already was in CSS, completing the four CSS-wide keywords. Nothing ever flagged it, so no consumer sees a difference.

## 0.2.0

### Minor Changes

- 8c7d56b: New package: the statically checkable half of `contracts.json` as a flat ESLint config.

  ```js
  import designSystem from '@elirobinson/eslint-config';
  export default [...designSystem()];
  ```

  - `no-barrel-imports` — bare `@elirobinson/*` specifiers never resolve, so they now fail
    the build rather than the runtime.
  - No foreign component libraries (MUI, Chakra, Ant Design, Mantine, HeroUI, Headless UI,
    DaisyUI) and no direct Radix imports, with an opt-out glob for a sanctioned gap-filler
    directory (`**/components/ui/**` by default).
  - `@elirobinson/no-hardcoded-design-values` — the check consumers cannot easily write
    themselves. Flags hex / `rgb()` / `oklch()` literals and magic px or ms for radius,
    shadow and duration in `className` strings, class-name helper calls (`cn`, `clsx`,
    `cva`, …) and `style` objects. Values already pointing at a token — `bg-background`,
    `rounded-[var(--radius-md)]` — pass, as do layout values like `w-[320px]`, because a rule
    that fires on everything gets disabled.

  `@elirobinson/eslint-config/css` applies the same rule to stylesheets via `@eslint/css`,
  which stays an optional peer dependency: importing the main entry never loads it.
  Custom-property definitions are left alone — that is what a token is.

  Every rule is named in the `verifiedBy` field of the contract it enforces.
