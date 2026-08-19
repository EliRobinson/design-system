---
'@elirobinson/tokens': minor
'@elirobinson/ai-patterns': minor
'@elirobinson/design-system-mcp': minor
---

Make the three dials queryable — a command, an MCP tool, and a roster you can import.

The palette/theme/platform split shipped the dials but left them undiscoverable.
Nothing you could run reported that `data-palette` or `data-platform` existed,
`ds tokens` printed one value per token where four exist, and the MCP server
answered for `ember/light` without saying so. The only way to learn the system
had three dials was to read our stylesheets — which is prose you would have had
to copy into your own docs, and wrong the day a third palette ships.

## `ds dials` — new

```
$ ds dials

DIALS  3 attributes on the root element; an absent attribute is the default

  palette   data-palette   ember (default)  slate
            40 tokens — the brand — neutral hue and chroma, --signal-*, --anchor-*, --accent*, --link*, --focus-ring

  theme     data-theme     light (default)  dark
            62 tokens — surfaces and text, and the re-picked value of everything the palette owns

  platform  data-platform  desktop (default)  mobile
            12 tokens — geometry only — radii, the small end of the type ramp, --gutter, the narrow containers. No colour.

COMBINATIONS (4)  palette x theme — the dials that move colour
  ember/light  (no attributes — this is the default)
  ember/dark   data-theme="dark"
  slate/light  data-palette="slate"
  slate/dark   data-palette="slate" data-theme="dark"

PLATFORM  data-platform="mobile" re-points 12 of 196 tokens, on top of all 4 combinations
  each row is the desktop value -> the mobile value

  --radius-sm     4px -> 8px
  --gutter        max(20px, round(4vw, 4px)) -> 16px
  ...
```

Every row is derived from the installed package. Add a palette and this command
reports it on a version bump, with nothing to edit.

## `ds tokens` reports every combination — BEHAVIOUR CHANGE

A token that resolves the same everywhere still prints as one value. A token
that does not now prints one labelled row per combination, and any token the
platform layer re-points gets its override appended:

```
$ ds tokens status-success

  --status-success            oklch(51.9% 0.145 150)
  --status-success-fg
    ember/light               oklch(44% 0.12 150)
    ember/dark                oklch(78% 0.13 150)
    slate/light               oklch(44% 0.12 150)
    slate/dark                oklch(78% 0.13 150)

$ ds tokens radius-sm

  --radius-sm  4px
    [data-platform="mobile"]  8px
```

Two things changed for anything parsing this output. Values are now **resolved**
— a `var()` chain is followed to what it lands on, so `--accent` prints
`oklch(72.5% 0.175 65)` rather than `var(--signal-500)`. And a varying token's
values are indented under its name instead of sitting on the same line. If you
scrape `ds tokens`, read `ds dials` first and expect both shapes.

Against a `@elirobinson/tokens` older than this release, `ds tokens` prints what
it always did plus a line naming the upgrade — it does not fail.

## MCP: `get_dials`, and `search_tokens` names its combination

`get_dials` reports the roster, the combinations with the attributes that select
each, and the platform overrides. `search_tokens` applies the same printing rule
as the CLI and opens with the default combination, so an agent can no longer
read a value without being told which combination it belongs to.

Also fixed: `search_tokens` could not find `--scrim` or `--target`. The family
matcher required a trailing hyphen, so both were missing from the `Prefixes:`
list a failed search suggests — `{prefix: 'scrim'}` was a dead end with no way
out, and `{prefix: 'target'}` returned `--target-min` and `--target-lg` but never
`--target` itself. Both spellings now work.

## `@elirobinson/tokens/dials` — new export

The roster as data, for anything that generates:

```js
import { COMBINATIONS, DIALS, PALETTES, tokenDials } from '@elirobinson/tokens/dials';
```

`DIALS`, `PALETTES`, `THEMES`, `PLATFORMS`, `COMBINATIONS`, `dialAttributeString()`
for the attributes that select a selection, `platformOverrides()` for what a
platform re-points, and `tokenDials()` for every token's value in every
combination. There is still exactly one list — `PALETTES` in `./contrast` — and
this re-exports it.

If you keep your own palette switcher, theme provider, or token table, this is
what it should read instead of a list of its own.

## Scaffolded apps can reach the dials

`create-elirobinson-design-system` now writes a `lib/dials.ts` and a pre-paint
bootstrap in the root layout, so a new app can render any combination instead of
only `ember/light`. It ships the plumbing and **no switcher UI** — which dials a
product exposes is a product decision. `lib/dials.ts` says where a switcher
attaches.

The bootstrap validates a stored palette against `PALETTES` from the roster, has
no system fallback for brand (there is no `prefers-*` signal for it, and an
absent attribute already means the default), and does both reads and both writes
in a single `try` — split across two, a visitor who chose slate could be painted
ember-dark on first paint when storage throws. `data-platform` is deliberately
not written: `mobile.css` already carries a `@media (max-width: 480px) and
(pointer: coarse)` twin, which is the right mechanism for one document served to
everything.

## Contracts

`tier-boundary` no longer enumerates the tiers — it points at
`@elirobinson/react/manifest`, whose `tiers` are read off the directory layout,
and adds the rule for when something belongs in `ai/`. `minimumTouchTarget` now
names `var(--target)`, `var(--target-min)` and `var(--target-lg)` rather than the
literal `44x44`, which had been instructing consumers to write a hardcoded pixel
value that the sibling `no-hardcoded-design-values` contract forbids and that
`data-platform="mobile"` cannot re-point.
