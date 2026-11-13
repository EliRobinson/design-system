---
'@elirobinson/eslint-config': major
---

`no-hardcoded-design-values` now reads the string keys of an object passed to a class-name helper (`cn`, `clsx`, `classnames`, `classNames`, `cva`, `twMerge`, or the names in `hardcodedValues.classNameFunctions`). The rule ships at `error`, so a build that passed before this upgrade can fail after it. These spellings are newly reported:

- `clsx({ 'bg-[#fff]': on })`: an arbitrary colour, radius, shadow or duration in an object key.
- `cn(open && { 'text-zinc-500': x })`: a Tailwind palette utility in an object key, also behind a condition.

Fix each one as you would fix the same class in a plain string: use a mapped utility (`bg-background`, `text-muted-foreground`) or `var(--accent)` in an arbitrary value. To find a token, run `pnpm ds tokens fg` for text colours or `pnpm ds tokens bg` for backgrounds. To keep a literal for a while, add it to `hardcodedValues.allow` as written (`allow: ['text-zinc-500']`). `no-hardcoded-control-geometry` already read these keys.
