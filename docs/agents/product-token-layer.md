# Product token layer

A pattern, **not tokens**. Nothing here is published by `@elirobinson/tokens`, nothing in
`packages/react` imports it, and no component declares a `--product-*` variable. This
document plus [`tokens.product-layer.css`](./tokens.product-layer.css) is the whole of it.

## What it is for

A product built on this system sometimes owns one signal of its own — a different accent,
a different verdict palette — while keeping the system's structure, spacing, type and
contrast contract. The wrong fixes for that are forking the token set or hardcoding a
literal in a component stylesheet. Both put a colour nobody measured into a slot the
contrast gate cannot see.

The product token layer is the third option: a small, fixed set of `--product-*` variables
that components read **through a fallback to a system token**, declared by the consumer
inside its own `[data-product]` scope.

**Miltinson Amber stays the system default.** A product that ships none of this gets the
system palette, unchanged.

## The rule that makes it optional

Every read is one level deep and always lands on a system token:

```css
/* correct */
color: var(--product-signal-fg, var(--status-warning-fg));

/* wrong — a product that declares nothing gets no colour at all */
color: var(--product-signal-fg);

/* wrong — a literal is a colour the contrast gate cannot follow */
color: var(--product-signal-fg, #b45309);

/* wrong — a chain the fallback cannot be resolved through */
color: var(--product-signal-fg, var(--product-accent, var(--status-warning-fg)));
```

`packages/react/scripts/product-layer.test.mjs` sweeps every component stylesheet and
fails a read that breaks any of those three rules. It also asserts that the set of
`--product-*` variables the components actually read is exactly the set the table below
documents, so the table cannot drift away from the code.

## The variables

| Variable                    | System fallback         | Role                                                                                                           |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `--product-signal`          | `--accent-press`        | A non-text state graphic — a caret, a rule, a dot. Needs 3:1 under SC 1.4.11. Not `--accent`, which is 2.53:1. |
| `--product-signal-fg`       | `--status-warning-fg`   | Brand colour a user **reads** — a mark, a glyph, a label. 9.69:1 light, 11.09:1 dark.                          |
| `--product-verdict-go`      | `--status-success-tint` | Affirmative verdict fill.                                                                                      |
| `--product-verdict-go-fg`   | `--status-success-fg`   | The foreground on that fill.                                                                                   |
| `--product-verdict-no`      | `--status-danger-tint`  | Negative verdict fill.                                                                                         |
| `--product-verdict-no-fg`   | `--status-danger-fg`    | The foreground on that fill.                                                                                   |
| `--product-verdict-hold`    | `--status-warning-tint` | Conditional verdict fill.                                                                                      |
| `--product-verdict-hold-fg` | `--status-warning-fg`   | The foreground on that fill.                                                                                   |

Which components read which is derivable — `grep -r 'var(--product-' packages/react/src`
— so it is not restated here. Today it is `ai/ChatMessage`, `ai/StreamingCaret` and
`molecules/VerdictBadge`. `organisms/DecisionCard` inherits the verdict palette through
the `VerdictBadge` it composes rather than reading it itself, which is the shape to copy:
a component that composes another should not re-read that component's variables.

## How a consumer adopts it

1. Copy [`tokens.product-layer.css`](./tokens.product-layer.css) into your app and import
   it **after** `@elirobinson/react/styles.css`.
2. Put `data-product` on the subtree the product owns — usually your app shell, not
   `<html>`. Scoping is what keeps this a product decision instead of a silent fork of the
   system for everything on the page.
3. Re-point only the lines your product actually owns. Leave the rest; each one that stays
   is a line you never have to re-measure.

```html
<html data-theme="dark">
  <body>
    <div data-product="atlas">…</div>
  </body>
</html>
```

## Two things that will bite

**The theme attribute sits above your scope.** `[data-theme='dark']` is normally on
`<html>` and `[data-product]` is somewhere inside `<body>`, so a dark override written as
`[data-product][data-theme='dark']` matches nothing. Use the descendant form, and match
the `.dark` class alias too — most theme switchers (next-themes included) default to a
class strategy:

```css
[data-theme='dark'] [data-product],
.dark [data-product] {
  /* … */
}
```

**A fill and its foreground move together or neither does.** Every verdict pair above is
two variables for one decision. Overriding `--product-verdict-go` and leaving
`--product-verdict-go-fg` on the system default is how a light tint ends up carrying light
text in dark mode — the same defect the status tints were given dark values to fix. If you
re-point one, re-point the other, and measure the pair in both themes.

The system defaults do not have this problem: they are semantic tokens that already flip,
which is why the dark block in the starter file is empty.

## What is deliberately not here

- **No `--product-*` token is published.** Adding one to `tokens.css` would make it a
  system token with a system default, which is the fork this pattern exists to avoid.
- **No component declares a fallback chain longer than one level.** Two levels means a
  product variable whose default is another product variable, and neither is guaranteed to
  exist.
- **No product's own values ship here.** The starter file restates the system defaults and
  nothing else. A product's palette lives in the product.
