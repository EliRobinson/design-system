# @elirobinson/eslint-config

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
