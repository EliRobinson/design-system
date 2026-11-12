---
'@elirobinson/eslint-config': minor
---

`no-hardcoded-control-geometry` now reads Tailwind arbitrary values. `min-h-[44px]`, `min-w-[44px]`, `h-[44px]`, `w-[44px]`, `size-[44px]`, `outline-[2px]` and `outline-offset-[2px]` in `className` and in the class-name helpers (`cn`, `clsx`, `classnames`, `classNames`, `cva`, `twMerge`, or the ones `hardcodedValues.classNameFunctions` names) get the same warning a style object gets. `min-h-[var(--target)]`, `outline-[var(--focus-ring-width)]` and scale utilities pass. It is still `warn` by default. Both this rule and `no-hardcoded-design-values` now also read the string keys of an object passed to a helper, as in `clsx({ 'bg-[#fff]': on })`.
