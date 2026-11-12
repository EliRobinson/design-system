---
'@elirobinson/eslint-config': minor
'@elirobinson/ai-patterns': patch
---

`no-hardcoded-control-geometry` now reads Tailwind classes. `min-h-[44px]`, `min-w-[44px]`, `h-[44px]`, `w-[44px]`, `size-[44px]`, `outline-[2px]`, `outline-offset-[2px]` and arbitrary properties such as `[min-height:44px]` get the same warning a style object gets. It reads them in `className` and in the class-name helpers (`cn`, `clsx`, `classnames`, `classNames`, `cva`, `twMerge`, or the ones `hardcodedValues.classNameFunctions` names), string keys of a helper's object argument included. `min-h-[var(--target)]`, `outline-[var(--focus-ring-width)]` and scale utilities pass. It is still `warn` by default.

`no-hardcoded-design-values` now names an arbitrary value the way it is written: `shadow-[0_4px_12px_#000]`, not `shadow-[0 4px 12px #000]`. An `allow` entry in either spelling matches.

`@elirobinson/ai-patterns`: the touch-target contract says the rule reads Tailwind arbitrary values too.
