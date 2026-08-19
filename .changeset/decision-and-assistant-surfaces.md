---
'@elirobinson/react': minor
'@elirobinson/ai-patterns': patch
---

Add six components for decision and assistant surfaces, and a new `ai` tier.

They were designed and proven in a product built on this system, where every one of them
had been hand-built because the library had no equivalent. Everything below is additive —
no existing component, class, or token changed, so upgrading needs no migration. What
follows is how to adopt them.

## New imports

There is no barrel; each component is its own subpath.

```tsx
import { ChatThread } from '@elirobinson/react/components/ai/ChatThread';
import { ChatMessage } from '@elirobinson/react/components/ai/ChatMessage';
import { StreamingCaret } from '@elirobinson/react/components/ai/StreamingCaret';
import { VerdictBadge } from '@elirobinson/react/components/molecules/VerdictBadge';
import { StubCard } from '@elirobinson/react/components/molecules/StubCard';
import { DecisionCard } from '@elirobinson/react/components/organisms/DecisionCard';
```

`ai/` is a **new tier directory**. If your app imports the aggregate
`@elirobinson/react/styles.css` you already have their styles. If you import per-component
sheets instead, add these:

```css
@import '@elirobinson/react/styles/ai/ChatThread.css';
@import '@elirobinson/react/styles/ai/ChatMessage.css';
@import '@elirobinson/react/styles/ai/StreamingCaret.css';
@import '@elirobinson/react/styles/molecules/VerdictBadge.css';
@import '@elirobinson/react/styles/molecules/StubCard.css';
@import '@elirobinson/react/styles/organisms/DecisionCard.css';
```

If you keep your own list of tiers anywhere — a codegen script, a docs sidebar, a lint
rule — it now needs `ai` alongside `atoms`, `molecules`, `organisms`. Better: read
`@elirobinson/react/manifest`, whose `tiers` array is derived from the directory layout
and already contains it.

## Required props, so a first render does not fail

These are the props with no default. Everything else is optional.

- `ChatThread` — **`label`** (string). The accessible name of the log region. There is no
  copy inside the component, so this is not optional and there is no fallback.
- `ChatMessage` — **`avatar`** (node). Required on purpose: there is no role-derived
  avatar. Pass a glyph, an initial, or an `<img>`. `variant` is `'sent' | 'received'` and
  defaults to `'received'`.
- `VerdictBadge` — **`verdict`** (`'go' | 'no' | 'hold'`) and **`label`** (string, the
  word). The glyph is supplied per verdict and can be overridden with `glyph`.
- `StubCard` — **`title`**, **`items`** (`{ label, value }[]`), **`stubLabel`**,
  **`stubValue`**.
- `DecisionCard` — **`verdict`**, **`verdictLabel`**, **`headline`**.

If you are migrating a hand-built chat surface, note that `ChatMessage` takes `actions` as
a **node**, not an `[{ label, onClick }]` array, and has no `citations` prop. Render your
own controls into `actions`.

## `DecisionCard` renders no footer when there is no action

This is a product guarantee, not a style choice, and adopting `DecisionCard` means
adopting it: when the `action` prop is absent, the component renders **no
`.ds-decision__foot` element at all** — not a disabled button, not a hidden one, nothing.
The card is structurally incapable of showing a payment control under a negative verdict.
Pass `closing` to give that verdict its last word; it renders in the body.

Two consequences for a consumer:

- Do not pass `action={<Button disabled />}` to represent "no action available". Omit
  `action` entirely. Passing a disabled node re-creates exactly the failure the guarantee
  exists to prevent.
- Any CSS or test of yours that assumes `.ds-decision__foot` is always present will not
  match on a card without an action. Query it conditionally.

`StreamingCaret` has the sibling rule: `active={false}` returns `null` rather than
rendering a hidden element, so it cannot be left mounted on a finished message. Drive it
from the same state that decides whether the stream is still running.

## Opting into the product token layer (optional)

All six read an optional `--product-*` layer, and every read falls back to a system token,
so doing nothing keeps the Miltinson defaults and full contrast coverage. To give your
product its own signal without forking the token set:

1. Copy `docs/agents/tokens.product-layer.css` from the design-system repo into your app
   and import it **after** `@elirobinson/react/styles.css`.
2. Put `data-product="<your-app>"` on the subtree your product owns — your app shell, not
   `<html>`.
3. Re-point only the variables you actually own:
   `--product-signal` (a non-text state graphic, needs 3:1), `--product-signal-fg` (brand
   colour a user reads), and the three verdict pairs `--product-verdict-{go,no,hold}` with
   their `-fg` counterparts.

Two rules that will bite otherwise. **Override a fill and its foreground together** — a
verdict pair is two variables for one decision, and re-pointing only the fill is how a
light tint ends up carrying light text in dark mode. And **write dark overrides as
descendant selectors** (`[data-theme='dark'] [data-product]`, plus `.dark [data-product]`
for class-strategy switchers), because the theme attribute normally sits on `<html>`,
above your product scope — `[data-product][data-theme='dark']` matches nothing.

Full reference: `docs/agents/product-token-layer.md`.

## Also in this release

`@elirobinson/ai-patterns`: the brand manifest gains a `component-card` category for
component specimen cards, and the design-project build no longer treats `ChatMessage` and
`ChatThread` as project-owned components now that the package ships them.
