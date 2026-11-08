# Adopt: from hand-written CSS

Use this file when the app's styles are its own stylesheets: literal hex colours, pixel
values, maybe a few custom properties of its own, and classes like `.btn` and `.card`
written in-house. It also covers CSS Modules and Sass, which compile to the same thing.

Do Step 0 of the adopt prompt first (`@elirobinson/ai-patterns/prompts/adopt-system.md`).
Turn on `@elirobinson/eslint-config/css` early. Its `no-hardcoded-design-values` rule
lists every literal colour, radius, shadow and duration left, file by file.

```css after
@import '@elirobinson/react/styles.css';
```

## The plan

1. Find the app's own design variables (`:root { --brand: … }`, Sass `$primary`). Map
   each one to a token by role, then delete it. Do not alias it (`--brand: var(--accent)`):
   an alias is a second name that the next person will set to a literal again.
2. Replace literals file by file with the tables below.
3. Replace in-house components (`.btn`, `.card`, `.modal`) with system components or
   their `ds-*` classes.

## Colour

Name the role first, then pick the token. Two hex values that look the same can have
different roles: one `#fff` is the page, another is a card on the page.

| What the colour is for       | Miltinson                                                 |
| ---------------------------- | --------------------------------------------------------- |
| Page background              | `--bg`                                                    |
| Card, panel, menu background | `--surface`                                               |
| Raised or hover surface      | `--surface-2`                                             |
| Quiet band behind content    | `--bg-subtle`                                             |
| Body text                    | `--fg`                                                    |
| Secondary text               | `--fg-2`                                                  |
| Captions and meta            | `--fg-3`                                                  |
| Disabled control text        | `--fg-disabled`                                           |
| Divider, card edge           | `--border`                                                |
| Input or control edge        | `--border-control`                                        |
| Brand colour, filled         | `--accent`                                                |
| Text on the brand fill       | `--accent-fg`                                             |
| Brand colour as text         | `--accent-ink`                                            |
| Second brand colour          | `--anchor`                                                |
| Link                         | `--link`                                                  |
| Link hover                   | `--link-hover`                                            |
| Error fill / text on it      | `--status-danger` · `--status-danger-on`                  |
| Error text on the page       | `--status-danger-fg`                                      |
| Error panel / its edge       | `--status-danger-tint` · `--status-danger-tint-edge`      |
| Success, warning, info       | `--status-success` · `--status-warning` · `--status-info` |
| Focus outline                | `--focus-ring`                                            |
| Modal backdrop               | `--scrim`                                                 |

Each status (`success`, `warning`, `danger`, `info`) has the same five members: the fill,
`-on`, `-fg`, `-tint`, `-tint-edge`. Warning also has `-border`, because its fill is too
light to stand alone. Use only semantic tokens. Never use a raw scale step (`--ink-500`)
in app code: it does not change with the theme.

```css before
:root {
  --brand: #e8a33d;
  --text: #1a1a1a;
  --muted: #6b6b6b;
}

.price-card {
  background: #fff;
  color: var(--text);
  border: 1px solid #e5e5e5;
}

.price-card__note {
  color: var(--muted);
}

.price-card__cta {
  background: var(--brand);
  color: #1a1a1a;
}

.price-card__cta:focus {
  outline: none;
}
```

```css after
.price-card {
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
}

.price-card__note {
  color: var(--fg-3);
}

.price-card__cta {
  background: var(--accent);
  color: var(--accent-fg);
}
```

`outline: none` is deleted, not replaced. `tokens.css` draws the focus ring.

## Type

Snap each `font-size` to the nearest step. `rem` values: multiply by 16 first.

| Source            | Source px | Miltinson  |
| ----------------- | --------- | ---------- |
| `11px`            | 11        | `--fs-2xs` |
| `12px`, `0.75rem` | 12        | `--fs-xs`  |
| `13px`            | 13        | `--fs-xs`  |
| `14px`            | 14        | `--fs-sm`  |
| `15px`            | 15        | `--fs-sm`  |
| `16px`, `1rem`    | 16        | `--fs-md`  |
| `18px`            | 18        | `--fs-lg`  |
| `20px`            | 20        | `--fs-xl`  |
| `22px`            | 22        | `--fs-xl`  |
| `24px`, `1.5rem`  | 24        | `--fs-2xl` |
| `28px`            | 28        | `--fs-3xl` |
| `32px`, `2rem`    | 32        | `--fs-3xl` |
| `36px`            | 36        | `--fs-4xl` |
| `40px`            | 40        | `--fs-4xl` |
| `48px`, `3rem`    | 48        | `--fs-5xl` |

A tie (13px, 15px, 22px) goes to whichever step keeps the text's rank against its
neighbours. `font-family` becomes `--font-sans`, `--font-display` for large headings, or
`--font-mono`. `font-weight` becomes `--fw-*` by number (400 is `--fw-regular`, 600 is
`--fw-semibold`). `line-height` becomes `--lh-tight`, `--lh-snug`, `--lh-normal` or
`--lh-relaxed`.

## Spacing

Snap `padding`, `margin` and `gap` to the nearest step.

| Source | Source px | Miltinson    |
| ------ | --------- | ------------ |
| `4px`  | 4         | `--space-1`  |
| `6px`  | 6         | `--space-1`  |
| `8px`  | 8         | `--space-2`  |
| `10px` | 10        | `--space-2`  |
| `12px` | 12        | `--space-3`  |
| `15px` | 15        | `--space-4`  |
| `16px` | 16        | `--space-4`  |
| `20px` | 20        | `--space-5`  |
| `24px` | 24        | `--space-6`  |
| `30px` | 30        | `--space-7`  |
| `32px` | 32        | `--space-7`  |
| `40px` | 40        | `--space-8`  |
| `48px` | 48        | `--space-9`  |
| `60px` | 60        | `--space-10` |
| `64px` | 64        | `--space-10` |
| `80px` | 80        | `--space-11` |

Page width: `max-width` becomes a `--container-*` token. Layer order: `z-index` becomes a
`--z-*` token (`--z-sticky`, `--z-modal`, `--z-toast`).

```css before
.toolbar {
  display: flex;
  gap: 10px;
  padding: 15px 20px;
  max-width: 1200px;
  z-index: 50;
}
```

```css after
.toolbar {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  max-width: var(--container-xl);
  z-index: var(--z-sticky);
}
```

## Radius

| Source | Source px | Miltinson     |
| ------ | --------- | ------------- |
| `2px`  | 2         | `--radius-xs` |
| `3px`  | 3         | `--radius-xs` |
| `4px`  | 4         | `--radius-sm` |
| `5px`  | 5         | `--radius-sm` |
| `6px`  | 6         | `--radius-md` |
| `8px`  | 8         | `--radius-md` |
| `10px` | 10        | `--radius-lg` |
| `12px` | 12        | `--radius-lg` |
| `16px` | 16        | `--radius-xl` |
| `20px` | 20        | `--radius-xl` |

`50%`, `999px` and `9999px` on a pill or a circle become `--radius-pill`.

## Shadow

Pick by how far the thing floats, not by matching the numbers.

| What it is                 | Miltinson                              |
| -------------------------- | -------------------------------------- |
| Hairline lift under a row  | `--shadow-xs`                          |
| Card resting on the page   | `--shadow-sm`                          |
| Dropdown, popover          | `--shadow-md`                          |
| Dialog, sheet              | `--shadow-lg`                          |
| Large floating panel       | `--shadow-xl`                          |
| Pressed or inset well      | `--shadow-inset`                       |
| Focus glow (`0 0 0 3px …`) | Delete it. The token sheet draws focus |

## Components

In-house component classes become system components (React) or their `ds-*` classes
(server-rendered HTML). `bootstrap.md` lists the class names for each component; they are
the same here. Run `pnpm ds props <Name>` for the React props.

| In-house pattern                    | Miltinson                        |
| ----------------------------------- | -------------------------------- |
| `.btn`, `.button`                   | `<Button variant="primary">`     |
| `.btn--secondary`, `.btn-outline`   | `<Button variant="secondary">`   |
| `.btn--danger`                      | `<Button variant="destructive">` |
| `.card`, `.panel`, `.box`           | `Card`                           |
| `.tag`, `.pill`, `.label`           | `<Badge variant="default">`      |
| `.message--error`, `.flash`         | `<Alert variant="danger">`       |
| `.field` with `<label>` + `<input>` | `<Input label="Email">`          |
| `.modal`                            | `Dialog`                         |
| `.tabs`                             | `Tabs`                           |
| `.loader`                           | `Spinner`                        |

```jsx before
export const Flash = ({ message }) => (
  <div className="flash flash--error">
    <strong>Could not save.</strong> {message}
  </div>
);
```

```jsx after
import { Alert } from '@elirobinson/react/components/molecules/Alert';

export const Flash = ({ message }) => (
  <Alert variant="danger" title="Could not save.">
    {message}
  </Alert>
);
```

When a class's last use is gone, delete its rules. A stylesheet that ends up empty is
deleted too.

## Check

- `pnpm lint` passes with `@elirobinson/eslint-config/css`. It finds every literal colour,
  radius, shadow and duration left in a stylesheet.
- No stylesheet still defines the app's old design variables.
- `grep -rn "outline: none" src` finds nothing.
- The page renders correctly with `data-theme="dark"` on `<html>`.
