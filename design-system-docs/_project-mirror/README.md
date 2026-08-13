# Claude Design project mirror

A verbatim copy of the parts of the **Miltinson Design System** Claude Design
project (`e160cbb7-83c8-4cf0-81d3-a358e70bc838`) that the repo does not own.

**This directory does not ship and does not render as-is.** Read that twice
before using anything in it.

## Why it is here, and not in `ui_kits/`

`design-system-docs/ui_kits/` ships to consumers — `BRAND_SOURCES` in
`packages/ai-patterns/scripts/build-artifacts.mjs` copies it into the
`miltinson-design` skill. Nothing in `_project-mirror/` is in that list, so
none of it reaches a consuming repo. That is deliberate: these files cannot
render here, and shipping a broken kit is worse than shipping no kit.

## Why they don't render

Two runtimes are in play, and this is the wrong one.

| | Runtime | Where it lives |
| --- | --- | --- |
| `ui_kits/` (the four originals) | `_shared/Primitives.jsx` — hand-written, inline-styled primitives on `window` | in this repo, self-contained |
| `_project-mirror/ui_kits/` (these nine) | `window.MiltinsonDesignSystem_e160cb`, from the project's `_ds_bundle.js` | **not copied** |

`_ds_bundle.js` is ~290KB of generated bundle built from the project's
*cosmetic* component recreations — the flat, prop-driven API (`<Dialog title
description footer>`, `<TabItem>`, `<Tooltip content side>`) that
`@elirobinson/react` does not have. Copying it here would import the exact API
this repo spent effort disowning, so it stays out. The project rebuilds it on
its own.

The page templates under `templates/` carry their own runtime — `support.js`
(~69KB of generated `dc-runtime`, byte-identical across all four) and
`ds-base.js` — but those still `<script src>` the same missing `_ds_bundle.js`.

## What is authored here vs generated

Authored design work, worth reading and worth diffing:

- `ui_kits/*/README.md` — the rules each kit encodes. The most valuable files here.
- `ui_kits/*/*.jsx` — kit screens.
- `templates/*/*.dc.html` — the four page templates.

Generated platform scaffolding, copied only so the templates are complete —
don't edit, don't review, re-copy from the project if it needs updating:

- `templates/*/support.js`
- `templates/*/ds-base.js`

## Gotchas found while mirroring

- **Kits import across directories.** `billing/index.html` loads
  `../settings/Settings.jsx` for its `<Page>` shell and renders `<BillingKit />`,
  not `<Billing />`; `notifications/` does the same. Don't move a kit in isolation.
- **`auth/ds-base.js` differs from the other three.** It enumerates all 44
  stylesheets individually instead of relying on `styles.css`. Left as-is —
  it's what the project has.

## If you want these for real

Port them onto `_shared/Primitives.jsx`, the way the original four kits work,
and move them up into `ui_kits/` so they render standalone and can ship. Pull
from the project at that point rather than from this mirror, which starts
going stale the moment the project changes — nothing regenerates it.
