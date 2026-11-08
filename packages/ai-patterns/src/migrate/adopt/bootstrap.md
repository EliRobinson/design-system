# Adopt: from Bootstrap

Use this file when the app uses Bootstrap 5's classes (`btn`, `card`, `form-control`) and
its CSS variables (`--bs-*`). Bootstrap sites are often not React apps, so this file shows
both:

- **React pages:** swap to `@elirobinson/react` components. `react-bootstrap` is banned
  by `@elirobinson/eslint-config`, so the lint run lists what is left.
- **Server-rendered HTML:** use the system's `ds-*` classes on the same elements. They are
  the classes the React components render, from `@elirobinson/react/styles.css`.

Do Step 0 of the adopt prompt first (`@elirobinson/ai-patterns/prompts/adopt-system.md`).
On a page with no React, Step 0 is just the stylesheet:

```css after
@import '@elirobinson/react/styles.css';
```

Remove `bootstrap.css` from the same page when its last class is gone. Until then, load
`styles.css` after it so the tokens win on the elements you have moved.

## Colour

Bootstrap's `--bs-*` variables and colour utilities map by role.

| Bootstrap                                      | Miltinson                   | Use it for                                        |
| ---------------------------------------------- | --------------------------- | ------------------------------------------------- |
| `--bs-body-bg`, `.bg-body`                     | `--bg`                      | The page                                          |
| `--bs-body-color`, `.text-body`                | `--fg`                      | Body and headings                                 |
| `--bs-secondary-color`, `.text-body-secondary` | `--fg-3`                    | Captions, meta                                    |
| `--bs-tertiary-bg`, `.bg-body-tertiary`        | `--bg-subtle`               | Quiet bands                                       |
| `--bs-secondary-bg`                            | `--bg-muted`                | Hover rows                                        |
| `--bs-border-color`                            | `--border`                  | Dividers, card edges                              |
| `--bs-primary` (main action)                   | `--fg`                      | Through `ds-button--primary`                      |
| `--bs-primary` (brand moment)                  | `--accent`                  | Through `ds-button--accent`                       |
| `--bs-link-color`                              | `--link`                    | Links                                             |
| `--bs-link-hover-color`                        | `--link-hover`              | Link hover                                        |
| `--bs-success`                                 | `--status-success`          | Success fill                                      |
| `--bs-danger`                                  | `--status-danger`           | Danger fill                                       |
| `--bs-warning`                                 | `--status-warning`          | Warning fill; edge with `--status-warning-border` |
| `--bs-info`                                    | `--status-info`             | Info fill                                         |
| `--bs-danger-bg-subtle`                        | `--status-danger-tint`      | Tinted panel (same for each state)                |
| `--bs-danger-text-emphasis`                    | `--status-danger-fg`        | Text on the tint                                  |
| `--bs-danger-border-subtle`                    | `--status-danger-tint-edge` | Edge of the tint                                  |
| `--bs-light`                                   | `--bg-subtle`               | Light band                                        |
| `--bs-dark`                                    | `--bg-inverse`              | Dark band                                         |
| `--bs-focus-ring-color`                        | `--focus-ring`              | Drawn by the token sheet; delete your own         |

Delete `data-bs-theme="dark"` handling. The system's switch is `data-theme="dark"` on
`<html>`.

```css before
.app-banner {
  background: var(--bs-tertiary-bg);
  color: var(--bs-secondary-color);
  border-bottom: 1px solid var(--bs-border-color);
}
```

```css after
.app-banner {
  background: var(--bg-subtle);
  color: var(--fg-3);
  border-bottom: 1px solid var(--border);
}
```

## Type

Bootstrap sizes in rem. Map by pixels. Headings get their size from `tokens.css`; set one
only where the design needs another.

| Bootstrap              | Source px | Miltinson  |
| ---------------------- | --------- | ---------- |
| `.display-1`           | 80        | `--fs-7xl` |
| `.display-4`           | 56        | `--fs-5xl` |
| `h1`, `.fs-1`          | 40        | `--fs-4xl` |
| `h2`, `.fs-2`          | 32        | `--fs-3xl` |
| `h3`, `.fs-3`          | 28        | `--fs-3xl` |
| `h4`, `.fs-4`          | 24        | `--fs-2xl` |
| `h5`, `.fs-5`, `.lead` | 20        | `--fs-xl`  |
| `h6`, `.fs-6`, body    | 16        | `--fs-md`  |
| `.small`, `small`      | 14        | `--fs-sm`  |

Weights: `.fw-semibold` is `--fw-semibold`, `.fw-bold` is `--fw-bold`.

## Spacing

Bootstrap's spacer steps (`p-1` to `p-5`, `gap-*`, `m-*`) map by pixels.

| Bootstrap | Source px | Miltinson   |
| --------- | --------- | ----------- |
| `*-1`     | 4         | `--space-1` |
| `*-2`     | 8         | `--space-2` |
| `*-3`     | 16        | `--space-4` |
| `*-4`     | 24        | `--space-6` |
| `*-5`     | 48        | `--space-9` |

On a page that still loads Bootstrap, its spacing utilities keep working; move them to CSS
with the token when you touch the element. On a Tailwind page, `p-4` is `--space-4`.

## Radius

| Bootstrap                | Source px | Miltinson     |
| ------------------------ | --------- | ------------- |
| `.rounded-1`             | 4         | `--radius-sm` |
| `.rounded`, `.rounded-2` | 6         | `--radius-md` |
| `.rounded-3`             | 8         | `--radius-md` |
| `.rounded-4`             | 16        | `--radius-xl` |
| `.rounded-5`             | 32        | `--radius-xl` |

`.rounded-pill` and `.rounded-circle` are `--radius-pill`.

## Shadow

| Bootstrap    | Miltinson     |
| ------------ | ------------- |
| `.shadow-sm` | `--shadow-sm` |
| `.shadow`    | `--shadow-md` |
| `.shadow-lg` | `--shadow-lg` |

## Components

Each row gives the React component and the HTML classes it renders. Run
`pnpm ds props <Name>` for the React props.

| Bootstrap                                                                          | Miltinson                        | HTML classes                                                                                                  |
| ---------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `.btn.btn-primary`                                                                 | `<Button variant="primary">`     | `ds-button ds-button--primary`                                                                                |
| `.btn.btn-outline-*`, `.btn-secondary`                                             | `<Button variant="secondary">`   | `ds-button ds-button--secondary`                                                                              |
| `.btn.btn-danger`                                                                  | `<Button variant="destructive">` | `ds-button ds-button--destructive`                                                                            |
| `.btn.btn-link`                                                                    | `<Button variant="ghost">`       | `ds-button ds-button--ghost`, or a plain `<a>`                                                                |
| `.btn-sm`, `.btn-lg`                                                               | `<Button size="sm">`             | `ds-button--sm`, `ds-button--lg`                                                                              |
| `.form-label` + `.form-control`                                                    | `<Input label="Email">`          | `ds-field`, `ds-label`, `ds-input`                                                                            |
| `.form-select`                                                                     | `<Select label="Plan">`          | `ds-field`, `ds-label`, `ds-input ds-select`                                                                  |
| `textarea.form-control`                                                            | `<Textarea label="Notes">`       | `ds-field`, `ds-label`, `ds-input ds-textarea`                                                                |
| `.form-check` (checkbox)                                                           | `<Checkbox label="Remember me">` | React only                                                                                                    |
| `.form-switch`                                                                     | `<Switch label="Email alerts">`  | React only                                                                                                    |
| `.card`, `.card-header`, `.card-body`, `.card-title`, `.card-text`, `.card-footer` | `Card`                           | `ds-card`, `ds-card__header`, `ds-card__content`, `ds-card__title`, `ds-card__description`, `ds-card__footer` |
| `.alert.alert-danger`                                                              | `<Alert variant="danger">`       | `ds-alert ds-alert--danger`, `ds-alert__title`, `ds-alert__description`                                       |
| `.badge`                                                                           | `<Badge variant="default">`      | `ds-badge ds-badge--default`                                                                                  |
| `hr`                                                                               | `Separator`                      | `ds-separator ds-separator--horizontal`                                                                       |
| `.placeholder`                                                                     | `Skeleton`                       | `ds-skeleton`                                                                                                 |
| `.spinner-border`                                                                  | `Spinner`                        | React only                                                                                                    |
| `.progress`                                                                        | `<Progress value={40}>`          | React only                                                                                                    |
| `.modal`                                                                           | `Dialog`                         | React only                                                                                                    |
| `.offcanvas`                                                                       | `Sheet`                          | React only                                                                                                    |
| `.dropdown`                                                                        | `DropdownMenu`                   | React only                                                                                                    |
| `.nav-tabs` + `.tab-content`                                                       | `Tabs`                           | React only                                                                                                    |
| `.accordion`                                                                       | `Accordion`                      | React only                                                                                                    |
| `.toast`                                                                           | `Toaster`                        | React only                                                                                                    |
| `.breadcrumb`                                                                      | `Breadcrumb`                     | React only                                                                                                    |
| `.pagination`                                                                      | `Pagination`                     | React only                                                                                                    |

"React only" means the component owns behaviour (focus, keyboard, ARIA state) that a class
cannot give you. On a page with no React, keep Bootstrap's script for that widget and
restyle it with tokens, or move the page to React. Do not copy a component's classes onto
hand-written markup and call it done.

```html before
<div class="card shadow-sm">
  <div class="card-body">
    <h5 class="card-title">Invite your team</h5>
    <p class="card-text text-body-secondary">They get access to every project.</p>
    <label for="email" class="form-label">Email</label>
    <input id="email" type="email" class="form-control" />
    <button type="submit" class="btn btn-primary mt-3">Send invite</button>
  </div>
</div>
```

```html after
<div class="ds-card">
  <div class="ds-card__header">
    <h3 class="ds-card__title">Invite your team</h3>
    <p class="ds-card__description">They get access to every project.</p>
  </div>
  <div class="ds-card__content">
    <div class="ds-field">
      <label for="email" class="ds-label">Email</label>
      <input id="email" type="email" name="email" class="ds-input" />
    </div>
  </div>
  <div class="ds-card__footer">
    <button type="submit" class="ds-button ds-button--primary">Send invite</button>
  </div>
</div>
```

The same screen in React:

```jsx after
import { Button } from '@elirobinson/react/components/atoms/Button';
import { Input } from '@elirobinson/react/components/atoms/Input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@elirobinson/react/components/molecules/Card';

export const Invite = () => (
  <Card>
    <CardHeader>
      <CardTitle>Invite your team</CardTitle>
      <CardDescription>They get access to every project.</CardDescription>
    </CardHeader>
    <CardContent>
      <Input label="Email" type="email" name="email" />
    </CardContent>
    <CardFooter>
      <Button type="submit" variant="primary">
        Send invite
      </Button>
    </CardFooter>
  </Card>
);
```

## Check

- `pnpm lint` passes with `@elirobinson/eslint-config` and `@elirobinson/eslint-config/css`.
  It rejects `react-bootstrap` imports and hard-coded colours in your CSS.
- No stylesheet still reads a `--bs-*` variable.
- `bootstrap.css` and `bootstrap.bundle.js` are gone, or kept on purpose for a widget the
  page still needs.
- The page renders correctly with `data-theme="dark"` on `<html>`.
