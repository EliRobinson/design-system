# @elirobinson/eslint-config

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
