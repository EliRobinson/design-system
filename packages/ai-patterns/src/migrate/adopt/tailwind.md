# Adopt: from raw Tailwind

Use this file when the app styles everything with Tailwind utilities and has no component
library. If it uses shadcn/ui, read `shadcn.md` too.

Do Step 0 of the adopt prompt first (`@elirobinson/ai-patterns/prompts/adopt-system.md`).
The parts that matter most here: import `@elirobinson/tokens/tailwind.css` after
`tailwindcss`, and turn on `@elirobinson/eslint-config`. The bridge is what makes the
utilities below mean something. The lint rule is what finds every `text-zinc-500` you
missed.

```css after
@import 'tailwindcss';
@import '@elirobinson/react/styles.css';
@import '@elirobinson/tokens/tailwind.css';
```

Tailwind v4 only. On v3, upgrade Tailwind first.

## Colour

Tailwind's palette (`gray-500`, `blue-600`) never changes with the theme. The bridge's
names do. Swap by role, not by hue: ask what the colour is for.

| Tailwind (before)                    | Miltinson                                          | Use it for                                                 |
| ------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------- |
| `bg-white` on the page               | `bg-background`                                    | The page                                                   |
| `bg-white` on a panel                | `bg-surface`                                       | Cards, panels, popovers                                    |
| `bg-gray-50`                         | `bg-background-subtle`                             | Quiet bands and wells                                      |
| `bg-gray-100`                        | `bg-muted`                                         | Hover rows, chips                                          |
| `text-gray-900`                      | `text-foreground`                                  | Body and headings                                          |
| `text-gray-700`                      | `text-foreground-2`                                | Secondary copy                                             |
| `text-gray-500`                      | `text-muted-foreground`                            | Captions, meta                                             |
| `text-gray-400` on disabled controls | `text-foreground-disabled`                         | Disabled labels                                            |
| `border-gray-200`                    | `border-border`                                    | Dividers, card edges                                       |
| `divide-gray-200`                    | `divide-border`                                    | Lines between list rows                                    |
| `border-gray-300` on inputs          | `border-input`                                     | Control edges (3:1)                                        |
| `bg-gray-900 text-white`             | `bg-primary text-primary-foreground`               | The high-contrast action                                   |
| `bg-blue-600 text-white` (brand CTA) | `bg-accent text-accent-foreground`                 | One brand moment per screen                                |
| `text-blue-600` (brand text)         | `text-accent-ink`                                  | Readable brand-coloured text                               |
| `text-blue-600 underline` (link)     | `text-link`                                        | Links                                                      |
| `text-red-600`                       | `text-destructive-ink`                             | Error text                                                 |
| `bg-red-50 border-red-200`           | `bg-destructive-tint border-destructive-tint-edge` | Error panel                                                |
| `bg-green-50 text-green-700`         | `bg-success-tint text-success-ink`                 | Success panel                                              |
| `bg-yellow-50 text-yellow-800`       | `bg-warning-tint text-warning-ink`                 | Warning panel                                              |
| `bg-blue-50 text-blue-700` (info)    | `bg-info-tint text-info-ink`                       | Info panel                                                 |
| `bg-red-600 text-white`              | `bg-destructive text-destructive-foreground`       | Filled danger                                              |
| `focus:ring-blue-500`                | `ring-ring`                                        | Only if you draw a ring; the token sheet already draws one |

Then delete every `dark:` colour variant. The bridge's names flip on `data-theme="dark"`
on their own, so a `dark:bg-gray-900` now fights the token.

```jsx before
export const Notice = () => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
    <p className="text-sm text-red-700 dark:text-red-300">Your card was declined.</p>
  </div>
);
```

```jsx after
export const Notice = () => (
  <div className="rounded-lg border border-destructive-tint-edge bg-destructive-tint p-4">
    <p className="text-sm text-destructive-ink">Your card was declined.</p>
  </div>
);
```

For a real alert, use `Alert` instead (see Components).

## Type

From `text-xs` to `text-3xl`, Tailwind's sizes and the system's sizes are the same pixels.
Keep those utilities. Above that they part ways, so use the token.

| Tailwind (before) | Source px | Miltinson  |
| ----------------- | --------- | ---------- |
| `text-xs`         | 12        | `--fs-xs`  |
| `text-sm`         | 14        | `--fs-sm`  |
| `text-base`       | 16        | `--fs-md`  |
| `text-lg`         | 18        | `--fs-lg`  |
| `text-xl`         | 20        | `--fs-xl`  |
| `text-2xl`        | 24        | `--fs-2xl` |
| `text-3xl`        | 30        | `--fs-3xl` |
| `text-4xl`        | 36        | `--fs-4xl` |
| `text-5xl`        | 48        | `--fs-5xl` |
| `text-6xl`        | 60        | `--fs-6xl` |
| `text-8xl`        | 96        | `--fs-7xl` |

`font-sans` and `font-mono` already point at the system faces through the bridge. Big
headings use `font-display`. Weights (`font-medium`, `font-semibold`) are the same numbers;
keep them.

```jsx before
export const Hero = () => (
  <h1 className="text-5xl font-bold tracking-tight text-gray-900">Plan less</h1>
);
```

```jsx after
export const Hero = () => (
  <h1 className="font-display text-(length:--fs-5xl) font-bold tracking-tight text-foreground">
    Plan less
  </h1>
);
```

## Spacing

Tailwind's spacing steps are 4px apart and the system's scale is built on the same steps,
so `p-4`, `gap-6` and friends stay. The lint rule allows them. Fix two things:

- An arbitrary value (`p-[13px]`, `mt-[22px]`). Snap it to the nearest step in the table
  below (22px is `p-6`, not `p-5`).
- An arbitrary width cap (`max-w-[720px]`). Use the nearest `--container-*` token:
  `max-w-(--container-md)`.
- Spacing in your own CSS. Use the `--space-*` token there.

| Tailwind (before) | Source px | Miltinson    |
| ----------------- | --------- | ------------ |
| `p-1`             | 4         | `--space-1`  |
| `p-2`             | 8         | `--space-2`  |
| `p-3`             | 12        | `--space-3`  |
| `p-4`             | 16        | `--space-4`  |
| `p-5`             | 20        | `--space-5`  |
| `p-6`             | 24        | `--space-6`  |
| `p-8`             | 32        | `--space-7`  |
| `p-10`            | 40        | `--space-8`  |
| `p-12`            | 48        | `--space-9`  |
| `p-16`            | 64        | `--space-10` |
| `p-20`            | 80        | `--space-11` |
| `p-24`            | 96        | `--space-12` |

```jsx before
export const Row = () => <div className="flex gap-[18px] px-[22px]">…</div>;
```

```jsx after
export const Row = () => <div className="flex gap-5 px-6">…</div>;
```

## Radius

The bridge re-points `rounded-*` at the system radii, so the same class can render a
different size after you import it. Snap by the pixels you had.

| Tailwind (before) | Source px | Miltinson                    |
| ----------------- | --------- | ---------------------------- |
| `rounded-xs`      | 2         | `rounded-xs` · `--radius-xs` |
| `rounded-sm`      | 4         | `rounded-sm` · `--radius-sm` |
| `rounded-md`      | 6         | `rounded-md` · `--radius-md` |
| `rounded-lg`      | 8         | `rounded-md` · `--radius-md` |
| `rounded-xl`      | 12        | `rounded-lg` · `--radius-lg` |
| `rounded-2xl`     | 16        | `rounded-xl` · `--radius-xl` |
| `rounded-3xl`     | 24        | `rounded-xl` · `--radius-xl` |

`rounded-full` maps to the pill radius and stays. A tie (8px sits between 6 and 10) goes
to the smaller step; pick the larger if the shape looked soft on purpose.

## Shadow

`shadow-xs` to `shadow-xl` re-point at the system shadows. `shadow-2xl` has no system shadow of its own; use `shadow-xl`.

| Tailwind (before)          | Miltinson        |
| -------------------------- | ---------------- |
| `shadow-sm`                | `shadow-sm`      |
| `shadow` / `shadow-md`     | `shadow-md`      |
| `shadow-lg`                | `shadow-lg`      |
| `shadow-xl` / `shadow-2xl` | `shadow-xl`      |
| `shadow-inner`             | `--shadow-inset` |

Do not add `shadow-*` to a system component. It already carries the right one.

## Components

Raw Tailwind apps build controls by hand. Replace each with the component. Run
`pnpm ds props <Name>` before you write one: it prints the import line and every prop.

| Hand-built pattern (before)                      | Miltinson                        |
| ------------------------------------------------ | -------------------------------- |
| `<button className="bg-gray-900 text-white …">`  | `<Button variant="primary">`     |
| `<button className="bg-blue-600 text-white …">`  | `<Button variant="accent">`      |
| `<button className="border bg-white …">`         | `<Button variant="secondary">`   |
| `<button className="hover:bg-gray-100 …">`       | `<Button variant="ghost">`       |
| `<button className="bg-red-600 …">`              | `<Button variant="destructive">` |
| `<label>` + `<input className="border …">`       | `<Input label="Email">`          |
| `<label>` + `<select>`                           | `<Select label="Plan">`          |
| `<label>` + `<textarea>`                         | `<Textarea label="Notes">`       |
| `<input type="checkbox">` + text                 | `<Checkbox label="Remember me">` |
| Toggle built from a checkbox                     | `<Switch label="Email alerts">`  |
| `<div className="rounded-lg border p-6 shadow">` | `Card`                           |
| `<span className="rounded-full px-2 text-xs …">` | `<Badge variant="default">`      |
| Coloured message box                             | `<Alert variant="danger">`       |
| Fixed overlay with a centred panel               | `Dialog`                         |
| Row of buttons that swap panels                  | `Tabs`                           |
| `animate-spin` circle                            | `Spinner`                        |
| `animate-pulse` grey blocks                      | `Skeleton`                       |

```jsx before
export function SignIn() {
  return (
    <form className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow">
      <label className="block text-sm font-medium text-gray-700" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        className="w-full rounded-md border border-gray-300 px-3 py-2"
      />
      <button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        Sign in
      </button>
    </form>
  );
}
```

```jsx after
import { Button } from '@elirobinson/react/components/atoms/Button';
import { Input } from '@elirobinson/react/components/atoms/Input';
import { Card, CardContent, CardFooter } from '@elirobinson/react/components/molecules/Card';

export function SignIn() {
  return (
    <Card>
      <form>
        <CardContent>
          <Input label="Email" type="email" name="email" autoComplete="email" />
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="primary">
            Sign in
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
```

The `<label>`, the focus ring, the 44px target and the dark theme all come with the
components. Delete the utilities that drew them.

## Check

- `pnpm lint` passes with `@elirobinson/eslint-config`. It reports every Tailwind palette
  colour (`text-zinc-500`) and every arbitrary colour, radius and shadow left.
- `grep -rn "dark:" src` finds only non-colour variants.
- The screen renders correctly with `data-theme="dark"` on `<html>`.
