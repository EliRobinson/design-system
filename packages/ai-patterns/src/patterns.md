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

## 6) UI Copy Is Chrome

Functional copy tells the reader what a thing is, what just happened, or what to
do next. That is errors, empty states, helper and hint text, toasts, labels,
button text, tooltips, confirmations, and validation messages. It is chrome, and
it is written plainly: **state the fact, then the consequence, then the action —
and stop.**

The failure mode is padding a true message with reassurance until it reads like
marketing. Never write:

- **Unverifiable frequency claims** — "this is almost always a passing blip",
  "this rarely happens", "most users find". You do not have that data.
- **Blame attribution** — "on their side", "check your connection". Say what is
  true and observable, not whose fault it might be.
- **Filler pacing** — "in a moment", "just a sec", "hang tight", "sit tight".
- **Unprompted reassurance or apology** — "don't worry", "no need to panic",
  "sorry about that", "we'll sort it out".
- **Escalation paths nobody asked for** — "if it keeps happening, reply to…"
  belongs in a support surface, not in a control's description.
- **Enthusiasm** — "Great news!", "You're all set!", exclamation marks.

Reassurance is allowed only when it answers a question the reader is actually
asking at that moment, and then it is a fact, not a mood: "You have not been
charged."

```
❌ You have not been charged. This is almost always a passing blip on their
   side, so try again in a moment. If it keeps happening, reply to your
   receipt email and we'll sort it out.

✅ You have not been charged. Try again.
```

Both say the same true thing. The second respects the reader.

**What this rule does not touch: a product's editorial voice.** Marketing prose,
conversational surfaces, and written deliverables are the product, and their
voice is a deliberate design decision — this rule has nothing to say about them.
The line is whether the text is _content_ (voice applies) or _chrome_ (this rule
applies). Where a surface mixes the two, the chrome still follows this rule and
the content is left alone. Read as an instruction to flatten a product's voice,
this rule does more harm than the padding it removes.

Length is the tell. If a piece of functional copy runs past two short sentences,
it is explaining, reassuring, or selling — cut it back to the fact and the
action.

`@elirobinson/eslint-config` warns on the literal phrases above, scoped the same
way: copy props (`title`, `description`, `label`, `placeholder`, and friends)
and the children of chrome components (`Alert`, `Toast`, `EmptyState`, …). It
never reads ordinary prose. It ships as a **warning**, not an error, because
every repo that upgrades into it has copy written before it existed. Tighten it
to `error` once that copy is clean:

```js
designSystem({ copy: { severity: 'error' } });
```

## 7) Definition of Done for UI Work

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
- [ ] **Functional copy states the fact, the consequence, the action, then
      stops.** No frequency claims, blame, filler pacing, unprompted
      reassurance, unasked escalation, or exclamation marks in errors, empty
      states, helper text, toasts, labels, tooltips, confirmations, or
      validation — see **UI Copy Is Chrome** above. The product's editorial
      voice is content, not chrome, and is not covered by this.
      `@elirobinson/eslint-config` warns on the literal phrases.
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
