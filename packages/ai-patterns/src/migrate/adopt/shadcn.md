# Adopt: from shadcn/ui

Use this file when the app has shadcn/ui components in `components/ui/` and Tailwind
utilities around them. Read `tailwind.md` for the utilities; this file covers the theme
variables and the components.

Do Step 0 of the adopt prompt first (`@elirobinson/ai-patterns/prompts/adopt-system.md`).

## The plan

1. Point Tailwind at the system with the bridge. shadcn's own components then render in
   system colours with no edit, because they read Tailwind's colour names.
2. Delete shadcn's theme variables. The bridge replaces them.
3. Swap each shadcn component for the system one, screen by screen.
4. Keep a shadcn component only when the system has none. It stays in `components/ui/`,
   which `@elirobinson/eslint-config` treats as the sanctioned gap-filler folder.

```css before
@import 'tailwindcss';

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --accent: oklch(0.97 0 0);
  --border: oklch(0.922 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
}
```

```css after
@import 'tailwindcss';
@import '@elirobinson/react/styles.css';
@import '@elirobinson/tokens/tailwind.css';
```

Delete the `:root` block, the `.dark` block and the `@theme inline` block. Do not alias
shadcn's names onto ours (`--accent: var(--accent)`): the names collide, the alias points
at itself, and the colour silently resolves to nothing. If the app uses `next/font`, keep
its two font lines as `--ds-font-sans-override` and `--ds-font-mono-override` (Step 0).

Move the theme switch from the `.dark` class to `data-theme="dark"` on `<html>`. With
`next-themes`, that is `attribute="data-theme"`.

## Colour

shadcn's variable names mostly mean the same thing as the bridge's colour names. Three do
not. Watch these when you touch a utility by hand.

| shadcn variable            | Miltinson                  | Note                                                                                                                 |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `--background`             | `--bg`                     | Same role                                                                                                            |
| `--foreground`             | `--fg`                     | Same role                                                                                                            |
| `--card`, `--popover`      | `--surface`                | Same role                                                                                                            |
| `--primary`                | `--fg`                     | shadcn's primary is the ink action; so is ours                                                                       |
| `--secondary`              | `--bg-subtle`              | Same role                                                                                                            |
| `--muted`                  | `--bg-muted`               | Same role                                                                                                            |
| `--muted-foreground`       | `--fg-3`                   | Same role                                                                                                            |
| `--accent`                 | `--surface-2`              | **Collision.** shadcn's accent is a hover tint. Ours is the brand colour. Use `bg-surface-2` or `bg-muted` for hover |
| `--destructive`            | `--status-danger`          | Same role                                                                                                            |
| `--border`                 | `--border`                 | Decorative edge                                                                                                      |
| `--input`                  | `--border-control`         | Control edge, 3:1                                                                                                    |
| `--ring`                   | `--focus-ring`             | The token sheet draws focus rings; do not add your own                                                               |
| `--chart-1` to `--chart-5` | `--chart-1` to `--chart-5` | Same idea; the system has eight series colours                                                                       |
| `--sidebar-*`              | `--surface`                | No sidebar set; use the surface tokens                                                                               |

`bg-accent` in shadcn code means "tint on hover or focus". After the bridge it paints the
brand colour, and its partner `text-accent-foreground` paints the ink that sits on brand,
which is near-black in both themes. Move both together. Search every variant, not only
`hover:`:

```bash
grep -rnE "(hover|focus|data-\[[^]]+\]):(bg|text)-accent(-foreground)?" src
```

Change `bg-accent` to `bg-muted` and `text-accent-foreground` to `text-foreground`.

```jsx before
export const Row = ({ children }) => (
  <div className="rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
    {children}
  </div>
);
```

```jsx after
export const Row = ({ children }) => (
  <div className="rounded-md px-2 py-1.5 hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground">
    {children}
  </div>
);
```

## Type

shadcn uses Tailwind's size utilities. Follow the Type section of `tailwind.md`: keep
`text-xs` to `text-3xl`, use the `--fs-*` token above that.

## Spacing

shadcn uses Tailwind's spacing steps, which match the system's. Keep them. Snap arbitrary
values (`h-[38px]`) to a step. A control's height is the component's job; once you swap the
component, delete the height.

## Radius

shadcn derives its radii from `--radius`. The bridge sets `--radius` for any shadcn
component you keep, so delete your own. When you swap a component, its radius comes with
it. For radii you wrote yourself, snap by pixels. In a shadcn app, use this table, not the
one in `tailwind.md`: shadcn's own `rounded-*` sizes come from `--radius`, not Tailwind's
defaults:

| shadcn utility | Source px | Miltinson                    |
| -------------- | --------- | ---------------------------- |
| `rounded-sm`   | 6         | `rounded-md` · `--radius-md` |
| `rounded-md`   | 8         | `rounded-md` · `--radius-md` |
| `rounded-lg`   | 10        | `rounded-lg` · `--radius-lg` |
| `rounded-xl`   | 14        | `rounded-xl` · `--radius-xl` |

## Shadow

shadcn uses `shadow-xs` on controls, `shadow-sm` on cards and `shadow-md`/`shadow-lg` on
overlays. The bridge maps each to the system shadow of the same name. The system components
carry their own shadows, so a swapped component needs none.

| shadcn utility | Miltinson   |
| -------------- | ----------- |
| `shadow-xs`    | `shadow-xs` |
| `shadow-sm`    | `shadow-sm` |
| `shadow-md`    | `shadow-md` |
| `shadow-lg`    | `shadow-lg` |

## Components

Most shadcn components have a system twin with the same compound names. The differences
that break a straight swap are in the right-hand column. Run `pnpm ds props <Name>` for the
full prop list and the import line.

| shadcn                                                             | Miltinson                                                          | What changes                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `<Button>` (default)                                               | `<Button variant="primary">`                                       | `variant="default"` becomes `primary`                                            |
| `<Button variant="outline">`                                       | `<Button variant="secondary">`                                     | No `outline`                                                                     |
| `<Button variant="link">`                                          | `<a>` styled by the token sheet                                    | No link variant; a link is a link                                                |
| `<Button size="icon">`                                             | `<Button size="sm" aria-label="Close">`                            | No icon size; give it a name                                                     |
| `<Input>` + `<Label>`                                              | `<Input label="Email">`                                            | `label` is required and wires the `<label>` for you                              |
| `<Textarea>` + `<Label>`                                           | `<Textarea label="Notes">`                                         | Same                                                                             |
| `<Checkbox>` + `<Label>`                                           | `<Checkbox label="Accept terms">`                                  | Same                                                                             |
| `<Switch>` + `<Label>`                                             | `<Switch label="Email alerts">`                                    | Same                                                                             |
| `Select` (Radix, `SelectItem`)                                     | `<Select label="Plan">`                                            | Native `<select>`; children are `<option>`                                       |
| `RadioGroup` + `RadioGroupItem`                                    | `RadioGroup`                                                       | `name` is required; each `RadioGroupItem` takes `label`                          |
| `Card` and its parts                                               | `Card`                                                             | Same part names; no `CardAction`, put actions in `CardFooter`                    |
| `Alert` + `AlertTitle` + `AlertDescription`                        | `<Alert variant="danger" title="Payment failed">`                  | Title is a prop; body is children; `destructive` is `danger`                     |
| `<Badge variant="secondary">`                                      | `<Badge variant="default">`                                        | Variants differ; no destructive badge                                            |
| `<Badge>` with a remove button                                     | `Chip`                                                             | shadcn has no removable badge                                                    |
| `Dialog` and its parts                                             | `Dialog`                                                           | `DialogTrigger` is the button; drop `asChild`                                    |
| `Sheet` and its parts                                              | `Sheet`                                                            | Same; `side` goes on `SheetContent`                                              |
| `DropdownMenu` and its parts                                       | `DropdownMenu`                                                     | Same core parts; no sub-menus                                                    |
| `Tooltip` + `TooltipProvider`                                      | `Tooltip`                                                          | No provider                                                                      |
| `Tabs` and its parts                                               | `Tabs`                                                             | Same                                                                             |
| `Accordion` and its parts                                          | `Accordion`                                                        | Same; set `headingLevel` to fit the page outline                                 |
| `Sonner` / `toast()`                                               | `Toaster`                                                          | Mount `Toaster`; call `useToast` inside it                                       |
| `Separator`, `Skeleton`, `Progress`, `Avatar`, `Slider`, `Popover` | `Separator`, `Skeleton`, `Progress`, `Avatar`, `Slider`, `Popover` | Same names; check props with `pnpm ds props`                                     |
| `Pagination` and its parts                                         | `Pagination`                                                       | One component, not compound: `page`, `pageCount` and `onPageChange` are required |
| `Breadcrumb` and its parts                                         | `Breadcrumb`                                                       | `BreadcrumbPage` is `BreadcrumbLink` with `current`; no `BreadcrumbEllipsis`     |
| `Command`                                                          | `CommandPalette`                                                   | Built on the system `Dialog`, not `cmdk`                                         |
| Combobox recipe (`Popover` + `Command`)                            | `Combobox`                                                         | One component; pass `options`                                                    |
| `NavigationMenu` and its parts                                     | `NavigationMenu`                                                   | One component fed `items`; no submenu triggers                                   |
| `ToggleGroup` (single)                                             | `SegmentedControl`                                                 | One component fed `options`                                                      |
| `Kbd`                                                              | `Kbd`                                                              | Same                                                                             |
| `Form` + `FormField` (react-hook-form)                             | `FormField`                                                        | Render prop hands you the ids and ARIA; not bound to react-hook-form             |
| `Calendar` + `Popover` date picker                                 | `DatePicker`                                                       | One component                                                                    |
| Data table recipe                                                  | `Table`, `VirtualTable`                                            | Pass `columns` and `data`; `VirtualTable` windows long lists                     |

```jsx before
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Rename() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Rename</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Rename project</DialogTitle>
        <Label htmlFor="name">Name</Label>
        <Input id="name" />
        <Button>Save</Button>
      </DialogContent>
    </Dialog>
  );
}
```

```jsx after
import { Button } from '@elirobinson/react/components/atoms/Button';
import { Input } from '@elirobinson/react/components/atoms/Input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@elirobinson/react/components/organisms/Dialog';

export function Rename() {
  return (
    <Dialog>
      <DialogTrigger>Rename</DialogTrigger>
      <DialogContent>
        <DialogTitle>Rename project</DialogTitle>
        <Input label="Name" name="name" />
        <DialogFooter>
          <Button variant="primary">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

```jsx before
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const Failed = () => (
  <Alert variant="destructive">
    <AlertTitle>Payment failed</AlertTitle>
    <AlertDescription>Your card was declined.</AlertDescription>
  </Alert>
);
```

```jsx after
import { Alert } from '@elirobinson/react/components/molecules/Alert';

export const Failed = () => (
  <Alert variant="danger" title="Payment failed">
    Your card was declined.
  </Alert>
);
```

When the last import of a `components/ui/<name>` file is gone, delete the file. When
`components/ui/` is empty, delete the shadcn dependencies (`@radix-ui/*`, `cmdk`,
`class-variance-authority`) the system does not need.

## Check

- `pnpm lint` passes. Outside `components/ui/`, it rejects direct `@radix-ui/*` imports.
- No `:root` block in the app still defines `--background`, `--primary` or `--accent`.
- No `bg-accent` or `text-accent-foreground` is left in a hover, focus or `data-` state,
  unless it is a brand hover on purpose.
- The screen renders correctly with `data-theme="dark"` on `<html>`.
