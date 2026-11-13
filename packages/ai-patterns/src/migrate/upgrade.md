# Upgrade: every breaking change, with before and after

One section per breaking change in an `@elirobinson/*` package, oldest first. Each names
the package, the version it broke in, and the changeset that broke it. The changeset id
is the same id that leads the entry in that package's `CHANGELOG.md`, which ships in the
package, so `node_modules/<package>/CHANGELOG.md` has the full story.

This file is checked against those changelogs and against `@elirobinson/tokens/migrations`
by this package's tests. A `major` changeset, or a 0.x `minor` one whose text starts with
`**Breaking:**`, fails the build until it has a section here for each package it ships in.

## How to use this file

1. Run `ds-resync` first. It tells you the version you are on and the version you are
   going to. Do not guess them from `package.json` ranges.

   ```bash
   pnpm --package=@elirobinson/ai-patterns dlx ds-resync --json
   ```

   If the packages were upgraded some other way, read the old versions from the lockfile
   in git history, and set the `package.json` ranges to the installed versions.

2. Read every section below whose **Version** is after the one you are on and at or
   before the one you are going to.
3. Run the **Find** pattern of **every** section, not only those. Code can lag the
   version it declares: a repo on react 1.4 can still hold a pre-1.0 import. A hit in an
   older section means apply it too. No hits means nothing to do.
4. Sections with a **Token migration** line are mechanical. Do not hand-edit them: run
   `ds-resync migrate` (step 4 of the ds-resync skill) and fix only what it prints under
   `left for you`. Without `.claude/ds-resync.json`, run it once per package, because each
   package has its own versions:

   ```bash
   pnpm --package=@elirobinson/ai-patterns dlx ds-resync migrate --only tokens --from 0.8.0 --to 0.20.1
   ```

5. Everything else is yours. Apply the **After** shape at each hit.
6. When you have to pick a token by hand, pick it by role. The Colour table in
   `adopt/plain-css.md` lists the role of each semantic token (body text, captions,
   control edge). Check the name exists with `pnpm ds tokens <filter>` before you write it.
7. Run the repo's typecheck, lint, tests and build. Then check the props you touched with
   `pnpm ds props <Name>`. That reads the installed package, so it is the authority.
8. Run `pnpm ds check`. It finds the known traps that make the app look wrong with no
   error, and prints the fix for each.

Below `1.0.0`, a minor release can break. Each section names its exact version, so the
rules above still hold.

## react-0.4-subpath-imports

- Package: `@elirobinson/react`
- Version: `0.4.0`
- Changeset: `52b1b6d`
- Find: `from '@elirobinson/react'` (a bare package import)

The root barrel export is gone. Every import names its component subpath.

```jsx before
import { Button, Card } from '@elirobinson/react';
```

```jsx after
import { Button } from '@elirobinson/react/components/atoms/Button';
import { Card } from '@elirobinson/react/components/molecules/Card';
```

The tier folder (`atoms/`, `molecules/`) arrived in 1.0.0. Take the next section too. To
get the exact line for any component, run `pnpm ds props <Name>`.

## tokens-0.2-subpath-imports

- Package: `@elirobinson/tokens`
- Version: `0.2.0`
- Changeset: `52b1b6d`
- Find: `from '@elirobinson/tokens'` (a bare package import)

The root export is gone. Token data comes from a subpath. Stylesheets were always subpaths
and are unaffected.

```jsx before
import { tokens } from '@elirobinson/tokens';
```

```jsx after
import { tokens } from '@elirobinson/tokens/tokens-data';

export const accent = tokens;
```

## ai-patterns-0.2-subpath-imports

- Package: `@elirobinson/ai-patterns`
- Version: `0.2.0`
- Changeset: `52b1b6d`
- Find: `from '@elirobinson/ai-patterns'` (a bare package import)

The root export is gone. The patterns and the contracts each have their own subpath:
`@elirobinson/ai-patterns/patterns` (Markdown) and `@elirobinson/ai-patterns/contracts`
(JSON).

```jsx before
import { contracts } from '@elirobinson/ai-patterns';
```

```jsx after
import contracts from '@elirobinson/ai-patterns/contracts' with { type: 'json' };

export const rules = contracts;
```

## react-1-tier-subpaths

- Package: `@elirobinson/react`
- Version: `1.0.0`
- Changeset: `af5497d`
- Find: `@elirobinson/react/components/[A-Z]` (a subpath with no tier folder)

Every component moved under its tier: `atoms/`, `molecules/` or `organisms/`. The tier is
part of the path. Nothing else about the components changed in this step.

```jsx before
import { Button } from '@elirobinson/react/components/Button';
import { Card } from '@elirobinson/react/components/Card';
import { Dialog } from '@elirobinson/react/components/Dialog';
```

```jsx after
import { Button } from '@elirobinson/react/components/atoms/Button';
import { Card } from '@elirobinson/react/components/molecules/Card';
import { Dialog } from '@elirobinson/react/components/organisms/Dialog';
```

Do not work out tiers by hand. `pnpm ds` lists every component with its tier, and
`pnpm ds props <Name>` prints the import line to copy.

## tokens-0.6-wcag-component-colours

- Package: `@elirobinson/tokens`
- Version: `0.6.0`
- Changeset: `84aef19`
- Find: `--(ink|signal|anchor)-[0-9]` in app code, and `border-input`

Component colours changed to meet WCAG 2.2 AA. Components stopped painting raw scale
values. New semantic tokens arrived for control edges, disabled text, readable amber and
status text. Most apps need no edit. Look at two things:

- App code that paints a raw scale value (`--ink-500`). Move it to the semantic token for
  its role, from the Colour table in `adopt/plain-css.md`. The example below is a
  disabled field; a hint or caption would take `--fg-3` instead.
- Tailwind `border-input`. It now resolves to `--border-control`, the 3:1 control edge.
  That is the intended edge for an input. Keep it.

```css before
.app-field {
  border: 1px solid var(--ink-300);
  color: var(--ink-400);
}
```

```css after
.app-field {
  border: 1px solid var(--border-control);
  color: var(--fg-disabled);
}
```

## tokens-0.9-warning-needs-an-edge

- Package: `@elirobinson/tokens`
- Version: `0.9.0`
- Changeset: `8938d09`
- Token migration: `warning-needs-an-edge`
- Find: `--status-warning` on a border or outline

`ds-resync migrate` rewrites this for you. A warning fill is too light to stand alone, so
its edge uses `--status-warning-border`. Keep the fill. Move only the edge. If text sits
on the fill, its colour is `--status-warning-on`, as below; the command does not add that
for you.

`ds-resync migrate` keeps listing the fill under `left for you` because of the
`tokens-0.9-status-brand-coupling` section below. Decide that once per fill, as that section
says.

```css before
.app-callout {
  background: var(--status-warning);
  border: 1px solid var(--status-warning);
}
```

```css after
.app-callout {
  background: var(--status-warning);
  border: 1px solid var(--status-warning-border);
  color: var(--status-warning-on);
}
```

## tokens-0.9-fg-on-signal-is-accent-fg

- Package: `@elirobinson/tokens`
- Version: `0.9.0`
- Changeset: `8938d09`
- Token migration: `fg-on-signal-is-accent-fg`
- Find: `--fg-on-signal`

`ds-resync migrate` rewrites this for you. It is a straight rename. Under the default
palette the colour does not move.

```css before
.app-cta {
  background: var(--accent);
  color: var(--fg-on-signal);
}
```

```css after
.app-cta {
  background: var(--accent);
  color: var(--accent-fg);
}
```

## tokens-0.9-status-fill-foreground

- Package: `@elirobinson/tokens`
- Version: `0.9.0`
- Changeset: `8938d09`
- Token migration: `status-fill-foreground`
- Find: `--fg-inverse` or `--fg-on-signal` as text on a `--status-*` fill

`ds-resync migrate` finds these but never rewrites them. Only you can see which status
fill the text sits on. Use that status's `-on` token.

```css before
.app-error-pill {
  background: var(--status-danger);
  color: var(--fg-inverse);
}
```

```css after
.app-error-pill {
  background: var(--status-danger);
  color: var(--status-danger-on);
}
```

## tokens-0.9-status-brand-coupling

- Package: `@elirobinson/tokens`
- Version: `0.9.0`
- Changeset: `8938d09`
- Token migration: `status-brand-coupling`
- Find: `--status-success`, `--status-warning`

The names did not change. The colours did: success and warning no longer borrow the brand
colours. `ds-resync migrate` lists each use. For each, decide what you meant. If you
wanted the brand colour, say so with `--accent` or `--anchor`. If you wanted the status,
keep the token.

```css before
.app-plan-badge {
  background: var(--status-warning);
}
```

```css after
.app-plan-badge {
  background: var(--accent);
  color: var(--accent-fg);
}
```

## tokens-0.9-status-hues-tuned

- Package: `@elirobinson/tokens`
- Version: `0.9.0`
- Changeset: `8938d09`
- Token migration: `status-hues-tuned`
- Find: nothing to find

No action. The rest of each status set moved a few degrees of hue. Every pair still meets
its contrast floor. This entry explains a visual diff, nothing more.

## tokens-0.9-neutral-ramp-dialled

- Package: `@elirobinson/tokens`
- Version: `0.9.0`
- Changeset: `8938d09`
- Token migration: `neutral-ramp-dialled`
- Find: nothing to find

No action. The neutral ramp is now built from palette dials. The declared values changed;
the rendered colours did not.

## ai-patterns-0.23-dense-touch-targets

- Package: `@elirobinson/ai-patterns`
- Version: `0.23.0`
- Changeset: `b0d68d7`
- Find: `data-touch-target="dense"`

`data-touch-target="dense"` used to mean "do not measure". It now means "measure against
24x24". A dense control under 24x24 that passed before now fails
`expectDesignSystemContracts`. Grow the hit area, not the painted glyph: give the control a
`--target-min` sized hit area.

```css before
.app-row-remove {
  width: 16px;
  height: 16px;
}
```

```css after
.app-row-remove {
  position: relative;
  width: var(--space-4);
  height: var(--space-4);
}

.app-row-remove::after {
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  width: var(--target-min);
  height: var(--target-min);
  transform: translate(-50%, -50%);
}
```

There is no "skip" value. If a control truly cannot meet 24x24, narrow the test's
`selector` or add it to `exempt` at the call site, where review can see it.

## tokens-0.14-form-control-typeface

- Package: `@elirobinson/tokens`
- Version: `0.14.0`
- Changeset: `1fe26ac`
- Find: nothing to find

No action unless you set a font on native controls yourself. `tokens.css` now makes
`button`, `input`, `select` and `textarea` inherit the page font, in `@layer base`. Your
own unlayered rules still win. If a screenshot test shows a control's text change from
Arial to the system font, that is this change.

## react-2-styles-css-only

- Package: `@elirobinson/react`
- Version: `2.0.0`
- Changeset: `cc6dd9d`
- Find: `@elirobinson/react/styles/` not ending in `.css`

The `./styles/*` export now serves `.css` files only. Every documented import already ends
in `.css` and keeps working. Anything else through `styles/` now fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED`. Import the component from its component subpath.

```jsx before
import { Button } from '@elirobinson/react/styles/atoms/Button.tsx';
```

```jsx after
import { Button } from '@elirobinson/react/components/atoms/Button';
import '@elirobinson/react/styles/atoms/Button.css';
```

Most apps import `@elirobinson/react/styles.css` once instead, which carries every
component's styles.

## react-2-manifest-importspecifier

- Package: `@elirobinson/react`
- Version: `2.0.0`
- Changeset: `2c3c5e7`
- Find: `importPath` in code that reads `@elirobinson/react/manifest`

Only matters if your code reads the component manifest. Its `importPath` field is gone.
`importSpecifier` holds the same value.

```jsx before
const lines = manifest.components.map((c) => c.importPath);
```

```jsx after
import manifest from '@elirobinson/react/manifest' with { type: 'json' };

export const lines = manifest.components.map((c) => c.importSpecifier);
```

## react-3-decisioncard-molecules

- Package: `@elirobinson/react`
- Version: `3.0.0`
- Changeset: `e75165d`
- Find: `organisms/DecisionCard`

`DecisionCard` moved from `organisms/` to `molecules/`. Both of its paths change. Its
props, markup and output did not.

```jsx before
import { DecisionCard } from '@elirobinson/react/components/organisms/DecisionCard';
import '@elirobinson/react/styles/organisms/DecisionCard.css';
```

```jsx after
import { DecisionCard } from '@elirobinson/react/components/molecules/DecisionCard';
import '@elirobinson/react/styles/molecules/DecisionCard.css';
```

If you import `@elirobinson/react/styles.css`, only the component import changes.

## tokens-1-container-sm-is-shell-sm

- Package: `@elirobinson/tokens`
- Version: `1.0.0`
- Changeset: `f3df86e`
- Token migration: `container-sm-is-shell-sm`
- Find: `--container-sm`, and Tailwind `max-w-sm` (or `w-`, `min-w-`, `basis-`, `inline-`, `columns-`)

`ds-resync migrate` rewrites the token for you. The page widths `--container-sm` …
`--container-2xl` are now `--shell-sm` … `--shell-2xl`, with the same values. The old
names were Tailwind v4's own, and `tokens.css` declared them outside any layer, so they
replaced Tailwind's: `max-w-md` was 768px, not 448px. This section and the four after it
are the same change, one per size.

`var(--container-*)` always meant the design system's width, so the rename renders the
same. The part the command cannot do is the Tailwind utilities. After the upgrade,
`max-w-sm` … `max-w-2xl` get Tailwind's sizes back (24rem, 28rem, 32rem, 36rem, 42rem).
Where one meant the design system's width, name the shell. Run `pnpm ds check` before you
upgrade: it lists every such utility, and it stops listing them after the upgrade.

`ds-resync migrate` leaves a declaration of an old name for you, such as
`--container-md: 30rem` in a Tailwind `@theme` block. That one is Tailwind's. Keep it.

```jsx before
<main className="mx-auto max-w-md">
  <section style={{ maxWidth: 'var(--container-xl)' }}>Pricing</section>
</main>
```

```jsx after
<main className="mx-auto max-w-(--shell-md)">
  <section style={{ maxWidth: 'var(--shell-xl)' }}>Pricing</section>
</main>
```

`@elirobinson/tokens/tokens.json` renames the same five keys: `containerSm` …
`container2xl` are now `shellSm` … `shell2xl`.

## tokens-1-container-md-is-shell-md

- Package: `@elirobinson/tokens`
- Version: `1.0.0`
- Changeset: `f3df86e`
- Token migration: `container-md-is-shell-md`
- Find: `--container-md`, and Tailwind `max-w-md` (or `w-`, `min-w-`, `basis-`, `inline-`, `columns-`)

The `tokens-1-container-sm-is-shell-sm` change, for `--container-md`: it is now
`--shell-md`, and Tailwind's `max-w-md` is Tailwind's size again.

## tokens-1-container-lg-is-shell-lg

- Package: `@elirobinson/tokens`
- Version: `1.0.0`
- Changeset: `f3df86e`
- Token migration: `container-lg-is-shell-lg`
- Find: `--container-lg`, and Tailwind `max-w-lg` (or `w-`, `min-w-`, `basis-`, `inline-`, `columns-`)

The `tokens-1-container-sm-is-shell-sm` change, for `--container-lg`: it is now
`--shell-lg`, and Tailwind's `max-w-lg` is Tailwind's size again.

## tokens-1-container-xl-is-shell-xl

- Package: `@elirobinson/tokens`
- Version: `1.0.0`
- Changeset: `f3df86e`
- Token migration: `container-xl-is-shell-xl`
- Find: `--container-xl`, and Tailwind `max-w-xl` (or `w-`, `min-w-`, `basis-`, `inline-`, `columns-`)

The `tokens-1-container-sm-is-shell-sm` change, for `--container-xl`: it is now
`--shell-xl`, and Tailwind's `max-w-xl` is Tailwind's size again.

## tokens-1-container-2xl-is-shell-2xl

- Package: `@elirobinson/tokens`
- Version: `1.0.0`
- Changeset: `f3df86e`
- Token migration: `container-2xl-is-shell-2xl`
- Find: `--container-2xl`, and Tailwind `max-w-2xl` (or `w-`, `min-w-`, `basis-`, `inline-`, `columns-`)

The `tokens-1-container-sm-is-shell-sm` change, for `--container-2xl`: it is now
`--shell-2xl`, and Tailwind's `max-w-2xl` is Tailwind's size again.

## eslint-config-1-design-values-read-object-keys

- Package: `@elirobinson/eslint-config`
- Version: `1.0.0`
- Changeset: `93c7c45`
- Find: a string key with a colour or arbitrary value inside `cn(`, `clsx(` or another class-name helper, such as `{ 'bg-[#fff]':` or `{ 'text-zinc-500':`

`no-hardcoded-design-values` now reads the string keys of an object passed to a class-name
helper. It ships at `error`, so these keys now fail lint. Fix each one as you would fix the
same class in a plain string. To pick the token, run `pnpm ds tokens fg` for text colours
or `pnpm ds tokens bg` for backgrounds.

```jsx before
<div className={cn(open && { 'text-zinc-500': muted }, clsx({ 'bg-[#fff]': on }))} />
```

```jsx after
<div className={cn(open && { 'text-muted-foreground': muted }, clsx({ 'bg-background': on }))} />
```

To keep a literal for a while, add it to `hardcodedValues.allow` as written
(`allow: ['text-zinc-500']`).
