# Adopt: from MUI (Material UI)

Use this file when the app imports from `@mui/material` and themes it with
`createTheme`. The end state has no `@mui/*` import: `@elirobinson/eslint-config` bans
them, so the lint run is your to-do list.

Do Step 0 of the adopt prompt first (`@elirobinson/ai-patterns/prompts/adopt-system.md`).

## The plan

1. Import `@elirobinson/react/styles.css` once in the app shell, next to MUI's
   `ThemeProvider`. Both systems can run side by side while you move screens.
2. Swap components screen by screen, with the table in Components.
3. Move `sx` and `styled()` values to CSS that reads tokens, with the tables below.
4. When the last `@mui/*` import is gone, delete `ThemeProvider`, `CssBaseline`, the theme
   file, and the `@mui/*` and `@emotion/*` packages.

```jsx before
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({ palette: { primary: { main: '#1976d2' } } });

export const App = ({ children }) => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    {children}
  </ThemeProvider>
);
```

```jsx after
import '@elirobinson/react/styles.css';

export const App = ({ children }) => children;
```

`tokens.css` (inside `styles.css`) does what `CssBaseline` did, and the theme switch is
`data-theme="dark"` on `<html>`, not `palette.mode`.

## Colour

MUI names colours by intent (`primary`, `error`) on a palette you picked. Map by intent.
MUI's `primary` is usually your brand colour, but most uses of it are "the main action",
which in this system is ink (`--fg`). Keep the brand colour for one moment per screen.

| MUI theme path                        | Miltinson          | Use it for                             |
| ------------------------------------- | ------------------ | -------------------------------------- |
| `palette.background.default`          | `--bg`             | The page                               |
| `palette.background.paper`            | `--surface`        | Cards, menus, dialogs                  |
| `palette.text.primary`                | `--fg`             | Body and headings                      |
| `palette.text.secondary`              | `--fg-3`           | Captions, meta                         |
| `palette.text.disabled`               | `--fg-disabled`    | Disabled labels                        |
| `palette.divider`                     | `--border`         | Dividers                               |
| `palette.primary.main` (main action)  | `--fg`             | Through `<Button variant="primary">`   |
| `palette.primary.main` (brand moment) | `--accent`         | Through `<Button variant="accent">`    |
| `palette.primary.contrastText`        | `--accent-fg`      | Text on `--accent`                     |
| `palette.secondary.main`              | `--anchor`         | The second brand colour                |
| `palette.error.main`                  | `--status-danger`  | Fills; text is `--status-danger-fg`    |
| `palette.warning.main`                | `--status-warning` | Fills; needs `--status-warning-border` |
| `palette.info.main`                   | `--status-info`    | Fills; text is `--status-info-fg`      |
| `palette.success.main`                | `--status-success` | Fills; text is `--status-success-fg`   |
| `palette.action.hover`                | `--bg-muted`       | Hover rows                             |
| `palette.action.selected`             | `--surface-2`      | Selected rows                          |

## Type

MUI's variants map to plain elements plus `--fs-*`. There is no `Typography` component;
use `h1`–`h6` and `p` and let `tokens.css` style them, then set a size only where the
design needs another.

| MUI variant           | Source px | Miltinson  |
| --------------------- | --------- | ---------- |
| `h1`                  | 96        | `--fs-7xl` |
| `h2`                  | 60        | `--fs-6xl` |
| `h3`                  | 48        | `--fs-5xl` |
| `h4`                  | 34        | `--fs-3xl` |
| `h5`                  | 24        | `--fs-2xl` |
| `h6`                  | 20        | `--fs-xl`  |
| `subtitle1`, `body1`  | 16        | `--fs-md`  |
| `subtitle2`, `body2`  | 14        | `--fs-sm`  |
| `caption`, `overline` | 12        | `--fs-xs`  |

`h4` sits exactly between two steps; pick the one that keeps the page's heading order.
Weights map by number: `fontWeightMedium` is `--fw-medium`, `fontWeightBold` is
`--fw-bold`.

```jsx before
import Typography from '@mui/material/Typography';

export const Title = () => (
  <Typography variant="h5" color="text.secondary">
    Billing
  </Typography>
);
```

```jsx after
export const Title = () => <h2 className="app-section-title">Billing</h2>;
```

```css after
.app-section-title {
  font-size: var(--fs-2xl);
  color: var(--fg-3);
}
```

## Spacing

`theme.spacing(n)` is `8 * n` px. Map by pixels.

| MUI            | Source px | Miltinson    |
| -------------- | --------- | ------------ |
| `spacing(0.5)` | 4         | `--space-1`  |
| `spacing(1)`   | 8         | `--space-2`  |
| `spacing(1.5)` | 12        | `--space-3`  |
| `spacing(2)`   | 16        | `--space-4`  |
| `spacing(3)`   | 24        | `--space-6`  |
| `spacing(4)`   | 32        | `--space-7`  |
| `spacing(5)`   | 40        | `--space-8`  |
| `spacing(6)`   | 48        | `--space-9`  |
| `spacing(8)`   | 64        | `--space-10` |
| `spacing(10)`  | 80        | `--space-11` |
| `spacing(12)`  | 96        | `--space-12` |

`sx={{ p: 2 }}` means `spacing(2)`. `Stack spacing={2}` means a `gap` of `spacing(2)`.

```jsx before
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

export const Panel = ({ children }) => (
  <Box sx={{ p: 3, borderRadius: 1, boxShadow: 1, bgcolor: 'background.paper' }}>
    <Stack spacing={2}>{children}</Stack>
  </Box>
);
```

```jsx after
export const Panel = ({ children }) => (
  <div className="app-panel">
    <div className="app-stack">{children}</div>
  </div>
);
```

```css after
.app-panel {
  padding: var(--space-6);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  background: var(--surface);
}

.app-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
```

If the app also has Tailwind, `p-6 rounded-sm shadow-sm bg-surface` does the same; see
`tailwind.md`. Usually the right answer is `Card`, which already has all four.

## Radius

`shape.borderRadius` is 4px by default, and `borderRadius: n` in `sx` multiplies it.

| MUI               | Source px | Miltinson     |
| ----------------- | --------- | ------------- |
| `borderRadius: 1` | 4         | `--radius-sm` |
| `borderRadius: 2` | 8         | `--radius-md` |
| `borderRadius: 3` | 12        | `--radius-lg` |
| `borderRadius: 4` | 16        | `--radius-xl` |

A fully round shape (`borderRadius: '50%'`, `9999`) is `--radius-pill`.

## Shadow

MUI has 25 elevations. The system has five shadows. Map by band.

| MUI elevation | Miltinson     |
| ------------- | ------------- |
| 1             | `--shadow-xs` |
| 2–3           | `--shadow-sm` |
| 4–6           | `--shadow-md` |
| 8–12          | `--shadow-lg` |
| 16–24         | `--shadow-xl` |

`<Paper elevation={n}>` and `<Card>` become `Card`, which carries its own shadow.

## Components

Run `pnpm ds props <Name>` before you write one. It prints the import line and every prop.

| MUI                                                       | Miltinson                                     | What changes                                                                           |
| --------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `<Button variant="contained">`                            | `<Button variant="primary">`                  | Brand moment: `variant="accent"`                                                       |
| `<Button variant="outlined">`                             | `<Button variant="secondary">`                |                                                                                        |
| `<Button variant="text">`                                 | `<Button variant="ghost">`                    |                                                                                        |
| `<Button color="error">`                                  | `<Button variant="destructive">`              |                                                                                        |
| `<IconButton>`                                            | `<Button variant="ghost" aria-label="Close">` | Give it a name                                                                         |
| `<TextField label="Email">`                               | `<Input label="Email">`                       | `helperText` is `hint`; `error` takes the message, not a boolean                       |
| `<TextField multiline>`                                   | `<Textarea label="Notes">`                    |                                                                                        |
| `<TextField select>` / `Select` + `MenuItem`              | `<Select label="Plan">`                       | Native `<select>`; children are `<option>`                                             |
| `Autocomplete`                                            | `Combobox`                                    | Pass `options`, `label`, `onValueChange`                                               |
| `FormControlLabel` + `Checkbox`                           | `<Checkbox label="Remember me">`              |                                                                                        |
| `FormControlLabel` + `Switch`                             | `<Switch label="Email alerts">`               |                                                                                        |
| `RadioGroup` + `Radio`                                    | `RadioGroup`                                  | Each `RadioGroupItem` takes `label`                                                    |
| `Slider`                                                  | `<Slider label="Volume">`                     |                                                                                        |
| `Card`, `CardHeader`, `CardContent`, `CardActions`        | `Card`                                        | `CardHeader title` becomes `CardTitle` inside `CardHeader`; actions go in `CardFooter` |
| `Paper`                                                   | `Card`                                        |                                                                                        |
| `<Alert severity="error">`                                | `<Alert variant="danger">`                    | `AlertTitle` becomes the `title` prop                                                  |
| `<Chip label="Beta">`                                     | `<Badge variant="outline">`                   | Removable chip: `Chip` with `onRemove`                                                 |
| `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions` | `Dialog`                                      | Actions go in `DialogFooter`; open state via `open`/`onOpenChange`                     |
| `Drawer`                                                  | `Sheet`                                       |                                                                                        |
| `Menu` + `MenuItem`                                       | `DropdownMenu`                                |                                                                                        |
| `Popover`                                                 | `Popover`                                     |                                                                                        |
| `Tooltip title="…"`                                       | `Tooltip`                                     | Trigger and content are children                                                       |
| `Tabs` + `Tab` + panels                                   | `Tabs`                                        | `TabsList`, `TabsTrigger`, `TabsContent`                                               |
| `Accordion` + `AccordionSummary` + `AccordionDetails`     | `Accordion`                                   | `AccordionItem`, `AccordionTrigger`, `AccordionContent`                                |
| `Snackbar`                                                | `Toaster`                                     | `useToast` inside it                                                                   |
| `CircularProgress`                                        | `Spinner`                                     |                                                                                        |
| `LinearProgress`                                          | `<Progress value={40}>`                       |                                                                                        |
| `Skeleton`                                                | `Skeleton`                                    |                                                                                        |
| `Avatar`                                                  | `Avatar`                                      |                                                                                        |
| `Breadcrumbs`                                             | `Breadcrumb`                                  |                                                                                        |
| `Pagination`                                              | `Pagination`                                  | `page`, `pageCount`, `onPageChange`                                                    |
| `Stepper`                                                 | `Stepper`                                     | `steps` and `activeStep`                                                               |
| `Divider`                                                 | `Separator`                                   |                                                                                        |
| `Rating`                                                  | `Rating`                                      |                                                                                        |
| `Table` / `DataGrid`                                      | `Table`                                       | Pass `columns` and `data`; `VirtualTable` for long lists                               |
| `Typography`, `Box`, `Stack`, `Grid`                      | HTML elements                                 | Plus tokens; see Type and Spacing                                                      |

```jsx before
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

export function Invite({ error }) {
  return (
    <form>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Email"
        type="email"
        helperText="We send one invite."
        error={Boolean(error)}
      />
      <Button variant="contained" type="submit">
        Send invite
      </Button>
    </form>
  );
}
```

```jsx after
import { Button } from '@elirobinson/react/components/atoms/Button';
import { Input } from '@elirobinson/react/components/atoms/Input';
import { Alert } from '@elirobinson/react/components/molecules/Alert';

export function Invite({ error }) {
  return (
    <form>
      {error && <Alert variant="danger">{error}</Alert>}
      <Input label="Email" type="email" name="email" hint="We send one invite." error={error} />
      <Button variant="primary" type="submit">
        Send invite
      </Button>
    </form>
  );
}
```

## Check

- `pnpm lint` passes. It rejects every `@mui/*` import, so a clean run means the swap is
  done.
- `@mui/*` and `@emotion/*` are gone from `package.json`.
- The screen renders correctly with `data-theme="dark"` on `<html>`.
