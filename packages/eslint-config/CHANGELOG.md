# @elirobinson/eslint-config

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
