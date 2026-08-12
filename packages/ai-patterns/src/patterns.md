# AI Product Patterns

## 1) Ask, Then Act

- Ask one concise clarifying question only when critical context is missing.
- Otherwise execute and show progress incrementally.

## 2) Explain Decisions, Not Just Diffs

- Include why token/component choices were made.
- Tie rationale to brand voice and accessibility requirements.

## 3) Safe Defaults

- Prefer semantic tokens over hardcoded values.
- Ship keyboard-first interactions and visible focus states by default.

## 4) Reusable Prompts

- Prompt templates should include intent, constraints, and verification checklist.
- Keep all prompts in repo-controlled files for auditability.

## 5) Discover, Don't Document

Never paste a component inventory, token list, or prop signature into prose — not
into a README, not into an agent instruction file, not into a comment. Query the
installed package instead:

```bash
pnpm ds                  # components, exports, variants, hooks, typography, token groups
pnpm ds props <Name>     # props, variant unions, and the exact import line to copy
pnpm ds tokens [filter]  # tokens and their values
pnpm ds classes [filter] # CSS classes the system ships
```

(`pnpm exec elirobinson-ds` if the `ds` script is not wired up.)

Any list written down is wrong as of the next release, and a consumer who copied
it has no way to know. `@elirobinson/react` went from 24 flat components to 45
across `atoms`/`molecules`/`organisms` in one minor line; every hand-written
inventory silently rotted, while `ds` — which walks the installed package rather
than assuming its shape — kept working untouched. That is the whole reason the
CLI exists.

The same rule applies to this file. When something here can be derived from the
packages, derive it.

## 6) Definition of Done for UI Work

Work through this before calling any UI change finished. Each line is a contract
you can actually check, not a sentiment.

- [ ] **Reused what exists.** Ran `pnpm ds` and composed from the system before
      writing anything new.
- [ ] **Every `componentConstraints` check holds.** Run `pnpm ds contracts`; each
      constraint carries its own `check` and a `verifiedBy` naming what enforces it.
- [ ] **Imports name a subpath.** `@elirobinson/react/components/<tier>/<Name>` —
      there is no barrel export, and a bare package import does not resolve.
- [ ] **No second component vocabulary.** No MUI, Chakra, Ant, Mantine, HeroUI,
      Headless UI, DaisyUI; no direct Radix outside a sanctioned gap-filler.
- [ ] **No hardcoded design values.** Zero hex / `rgb()` / `oklch()` literals, and
      no magic px for radius, shadow, or duration. `@elirobinson/eslint-config`
      fails the build on these.
- [ ] **Typography goes through `.t-*` classes** or token-backed utilities, not
      ad-hoc font-size stacks.
- [ ] **Touch targets and visible focus meet the contract.** 44×44 for primary
      controls, the dense scale for inline affordances, no overlapping hit areas,
      and a focus ring on everything focusable. The Playwright helpers in
      `@elirobinson/ai-patterns/testing/playwright` check all of it.
- [ ] **Renders correctly under `data-theme="dark"`.** Token-driven UI inverts for
      free; anything that does not is a literal that escaped the rule above.
- [ ] **Any gap in the system is called out** explicitly, as a candidate for
      upstreaming rather than a local fork.

## Integration notes

These are the wiring mistakes that cost the most time to diagnose, because each
one fails silently rather than loudly.

### Dark mode: match the theme switcher to the selector

The system themes on `[data-theme="dark"]`. `next-themes` defaults to
`attribute="class"`, so the default wiring toggles a class the stylesheet never
looks at and dark mode does nothing at all. Configure it explicitly:

```tsx
<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
```

Since `@elirobinson/tokens@0.3.0` a `.dark` compatibility selector ships
alongside `[data-theme="dark"]`, so a class-strategy switcher also works. Prefer
`attribute="data-theme"` anyway — it is the convention the system documents, and
it is what every component's CSS is written against.

### Tailwind: import the bridge, don't hand-roll the mapping

Tailwind utilities like `bg-background` and `text-muted-foreground` resolve to
nothing unless the Tailwind color namespace is pointed at the tokens. One import
does it:

```css
@import 'tailwindcss';
@import '@elirobinson/tokens/tokens.css';
@import '@elirobinson/tokens/tailwind.css';
```

Do not write the mapping by hand. The shadcn/ui variable contract collides with
this system's token names — shadcn's `--accent` is a subtle hover tint, ours is
the brand signal colour — so the obvious `--accent: var(--accent)` alias is
circular and yields nothing. `tailwind.css` already handles that, along with
`--radius` for the shadcn components that read it directly.

### Fonts: `next/font` needs the family override, in an unlayered `:root`

`next/font` never exposes a family under its real name. It generates a hashed
one (`__Geist_e8ce0c`) and hands it over in a CSS variable, so the literal
`'Geist'` in `tokens.css` matches nothing it loaded and `body`, every `.t-*`
class and the `font-sans` utility all fall through to the system font. Nothing
errors. Point the families at the framework's variables instead:

```css
:root {
  --ds-font-sans-override: var(--font-geist-sans);
  --ds-font-mono-override: var(--font-geist-mono);
}
```

Two details decide whether that works:

- **Put the font's class on `<html>`, not `<body>`.** The tokens resolve at
  `:root`; a `--font-geist-sans` defined on `<body>` is not visible there, and
  the override resolves to nothing.
- **Do not wrap the block in `@layer base`.** `tokens.css` is unlayered, and an
  unlayered declaration beats a layered one regardless of order — so an
  override of `--font-sans` itself inside `@layer base`, which is where a
  Next.js `globals.css` conventionally puts base styles, silently loses. That
  rule holds for every token. The `--ds-font-*-override` hooks are the
  exception worth knowing: `tokens.css` declares them nowhere, so they apply
  from any layer.

Available since `@elirobinson/tokens@0.5.0`. Before it, the only working fix
was an unlayered `:root { --font-sans: … }` after the import.

### Stylesheet order

`@elirobinson/tokens/tokens.css` first, then `@elirobinson/react/styles.css`,
imported once in the app shell. Never per component.
