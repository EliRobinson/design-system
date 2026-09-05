# AI Elements theme

The Miltinson × AI Elements theme, as installed in `apps/docs`. It is two CSS layers and
some wiring, not a component library: **no AI Elements component is recreated or forked
anywhere in this repo**, and nothing here edits `packages/ai-elements/src/`.

## Where it lives

| Path                                            | What it is                                                  |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `apps/docs/src/app/ai-theme/ai-bridge.css`      | The token bridge — shadcn, xyflow and Streamdown variables  |
| `apps/docs/src/app/ai-theme/ai-core.css`        | Conversation, Message, PromptInput, Response, Code, Actions |
| `apps/docs/src/app/ai-theme/ai-agent.css`       | Reasoning, Tool, Sources, Task, Context, Artifact, Confirm  |
| `apps/docs/src/app/ai-theme/ai-media.css`       | Web Preview, Image, Attachments, Dropzone, Open In          |
| `apps/docs/src/app/ai-theme/ai-canvas.css`      | Canvas, Node, Edge, Toolbar, Controls, Panel                |
| `apps/docs/src/app/ai-theme/ai-shell.css`       | Assistant shell, threads, greeting, model picker, notices   |
| `apps/docs/src/app/ai-theme-bundler-fixups.css` | The one deviation — see "The port-size defect" below        |

`app/ai-theme/` is **verbatim** and is in `.prettierignore` for the same reason
`packages/ai-elements/src` is: these six files are authored in the design handoff and
re-landed whole, so formatting them turns the next drop into an unreadable diff. Edits go
to the handoff, not here. `ai-theme-bundler-fixups.css` is ours and is formatted.

## Import order

`apps/docs/src/app/elements.css` is the Tailwind entry and carries the whole chain:
Miltinson tokens → `@elirobinson/tokens/tailwind.css` → `ai-bridge.css` → the class layers
→ the fixups. That file's own comments carry the reasoning; the two rules that matter:

- **The bridge is app-level and must not be folded into `@elirobinson/tokens`.** It
  declares shadcn's names, and shadcn's `--accent` means "hover surface" while ours means
  the amber CTA fill. A bare `--accent: var(--bg-subtle)` at `:root` would turn every
  Miltinson button, link hover and eyebrow underline pale grey. Verified in the browser:
  after the bridge loads, `--accent` is still amber and only `--color-accent` moved.
- **The bridge is additive.** Miltinson declares none of the bare shadcn names
  (`--background`, `--primary`, `--secondary`, `--muted`, `--input`, `--ring`, …), so
  nothing it declares collides with a token.

## The overlap with `@elirobinson/tokens/tailwind.css`, and why it is not a fight

This repo already had a shadcn bridge before this one arrived: `tailwind.css` maps
Tailwind's namespaces onto the tokens, and `docs/agents/ai-elements.md` calls it "the skin".
Four names carry different values in the two files:

| name                         | `tokens/tailwind.css` | `ai-bridge.css`      |
| ---------------------------- | --------------------- | -------------------- |
| `--color-accent`             | `var(--accent)`       | `var(--bg-subtle)`   |
| `--color-secondary`          | `var(--bg-subtle)`    | `var(--bg-muted)`    |
| `--color-muted-foreground`   | `var(--fg-3)` 4.85:1  | `var(--fg-2)` 8.45:1 |
| `--color-primary-foreground` | `var(--bg)`           | `var(--fg-inverse)`  |

**In practice the divergence does not reach a Tailwind utility, and that is worth knowing
before anyone tries to "fix" it.** `tailwind.css` uses `@theme inline`, and `inline` means
the token reference is substituted into each utility at build time rather than emitted as a
runtime `--color-*` variable. Measured in this app: `.bg-secondary` compiles to
`background-color: var(--bg-subtle)`, not `var(--color-secondary)`. So the bridge's
`--color-*` half is inert for the vendored tree's utilities — the repo's four choices win —
and what the bridge actually contributes here is its `--xy-*` block, its `--streamdown-*`
theme pins, and the bare shadcn names.

The one consequence with a contrast argument behind it is `--color-muted-foreground`: the
handoff wants `--fg-2` (8.45:1) rather than `--fg-3` (4.85:1), on the grounds that AI
Elements puts it on 12px labels and a label with no headroom is one type-scale change from
failing. Today the repo's `--fg-3` is what paints. **Not resolved here** — moving it means
editing the published `tokens/tailwind.css`, which is a consumer-facing decision.

## The three dials

Verified in the browser across `data-palette` × `data-theme` × `data-platform="mobile"`.
Nothing in the layer assumes a value of any dial: the user bubble, the node run-state rule,
the submit fill, the bubble radius and the node port size all move. No component may assume
one value of any dial — if a rule needs a dark block or a palette block, the value it is
bridging is wrong.

## Status is always three channels

Colour **and** glyph **and** a word in the markup, for every status chip, task glyph, node
run state and meter level. Colour alone is SC 1.4.1, and "amber" is not a status a screen
reader can read out. The vendored `ToolHeader` already does this upstream (lucide glyph +
`statusLabels` word + colour); `workflow-canvas.tsx` does it through its `STATE` table,
where a state cannot be added without both fields.

## The canvas keyboard path — not optional

`ai-canvas.css` styles a graph whose primary interaction is dragging, and its header states
that the stylesheet may only be installed if the app ships two things. Both are in
`apps/docs/src/examples/ai-elements/workflow-canvas.tsx`, and that file is **mounted** on
`/components/ai-elements/examples` — a keyboard path no route renders is not shipped.

- **Arrow-key nudging.** `nodesFocusable` puts nodes in the tab order and `nodesDraggable`
  keeps xyflow's arrow-key handler live. Verified: Enter selects, three ArrowRight presses
  move the node, and xyflow's live region announces "Moved selected node right. New
  position, x: 10, y: 0".
- **A menu path to create and delete a connection.** Focusing a port opens the node's
  `Toolbar` with one button per other node — "Connect to …" / "Disconnect from …". Verified:
  connect took the edge count 1 → 2, disconnect took it 2 → 1.

Those two are **the only reason a 12px port is allowed to be 12px** — SC 2.5.8 exempts a
target with an equivalent alternative. If either is ever removed, the ports must go to 24px
and the graph must be re-laid-out around them. Do not ship the canvas styled and undriven.

## The port-size defect this app had to fix

`ai-canvas.css` draws a port at 12px; `@xyflow/react/dist/style.css` draws the same element
at 6px. Both selectors are (0,1,0), and xyflow's stylesheet is later — the vendored
`canvas.tsx` imports it from module scope, so Turbopack emits it as that component's own
chunk, after the layout's CSS. Measured before the fix: 6×6 with a 1px edge, half a target
that is already at the floor of what the exemption carries.

Import order does not fix it. Naming `@xyflow/react/dist/style.css` from `elements.css`
ahead of the canvas layer was tried: Turbopack does not dedupe it against the module-scope
import, so the page ships the stylesheet twice and the later copy still wins.

`ai-theme-bundler-fixups.css` re-asserts the geometry at `.ds-ai-node .ds-ai-node__port`
(0,2,0), taking the specificity from structure that is already there rather than from a
doubled class. **That is deliberate and is not the handoff's doubling rule.** The
`.ds-ai-x.ds-ai-x` doubles in `app/ai-theme/` exist for declarations that contend with a
Tailwind group variant, and the handoff asks that no new ones be added outside that case —
a stylesheet of defensive doubles is a different and worse problem. Do not collapse the
existing doubles, and do not add more.

The fixups file introduces no value of its own. Every declaration is copied from the rule in
`ai-canvas.css` it re-asserts; if those values move, these are wrong and must move with them.

## Colours

**No new colour was introduced.** Every pair the layer uses was already measured and is
recorded in the handoff's `accessibility.md`. All 99 `var(--…)` names the six files
reference resolve against `@elirobinson/tokens`. If you think you need a new one, measure it
against `--bg` in both themes and every palette and record it — do not invent one.

## Known gaps

- **`.ds-ai-tool__status` cannot be applied.** `ToolHeader` builds its status badge
  internally and exposes no `className` for it, so the badge keeps its `secondary` variant
  (`--bg-muted` / `--fg`, 19.5:1). It already renders all three channels, so this is a
  styling gap and not an accessibility one.
- **`.ds-ai-model-list` uses `--anchored-min-width`,** which in the handoff's source project
  was a global token. Here it is declared locally on `.ds-dropdown__content` in
  `packages/react`, so that one `min-inline-size` resolves to nothing.
- **The vendored `Canvas` paints `bgColor="var(--sidebar)"`** — the bare name, which neither
  bridge declares (the handoff's bare-names list omits sidebar on purpose). It resolves to
  nothing; `.ds-ai-canvas` paints its own background, so the visible result is correct.
- **The theme is installed app-level, so consumers get none of it.** The handoff's
  `porting-notes.md` asks for a published `@elirobinson/ai-elements-theme` package instead,
  which is also what the root rule ("nothing we publish may require a consumer to update
  prose") argues for. Deliberately out of scope for the install; it is a packaging decision.
- **The `.ds-ai-*` classes reach only this app's own compositions** —
  `src/examples/ai-elements/*`. The rendered demos elsewhere come from
  `packages/ai-elements/fixtures/`, which is published as
  `@elirobinson/ai-elements/fixtures`; putting app-level theme class names into a published
  package is a boundary call that has not been made.
