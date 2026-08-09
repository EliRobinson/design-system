## How to build with Miltinson

### Setup: no provider, one stylesheet

There is **no ThemeProvider, no root wrapper, no context setup**. Link
`styles.css` once and render components directly — that stylesheet's `@import`
closure carries the tokens, the Google-hosted Geist / JetBrains Mono webfonts,
and every component's CSS. Do not invent a provider; wrapping components in one
is the most common wrong guess with this library.

One exception: **Toast**. Mount `<Toaster />` once near the root, then fire
toasts from the `useToast()` hook — a `toast()` call with no `Toaster` mounted
renders nothing.

```jsx
const { Toaster, useToast, Button } = window.MiltinsonDS;

function Demo() {
  const { toast } = useToast();
  return (
    <Button onClick={() => toast({ title: 'Saved', description: 'All changes stored.' })}>
      Save
    </Button>
  );
}
// once, near the root:  <><Demo /><Toaster /></>
```

**Dark mode** is real and free: set `data-theme="dark"` on a wrapping element
(or let `prefers-color-scheme` do it). Every token re-resolves. Never hardcode
a hex — that is what breaks dark mode.

### The styling idiom: CSS custom properties

This is a **token + semantic-class** system, not a utility-class system. There
is no `bg-surface-1`/`gap-md` vocabulary — inventing utility class names
produces unstyled output.

Two rules:

1. **For the components** — pass props (`variant`, `size`, `tone`). Their
   internal classes are BEM (`ds-button`, `ds-button--accent`,
   `ds-table__sort`). Those are implementation detail: **never hand-write a
   `ds-*` class**, and never restyle one.
2. **For your own layout glue** — plain CSS (inline `style` or your own
   classes) using `var(--token)`. Every value you need is a token:

| Group    | Real names                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces | `--bg`, `--bg-subtle`, `--bg-muted`, `--bg-inverse`, `--surface`, `--surface-2`, `--surface-3`                                                                             |
| Text     | `--fg`, `--fg-inverse`, `--fg-on-signal`, `--link`, `--link-hover`, `--link-visited`                                                                                       |
| Borders  | `--border`, `--border-strong`, `--border-inverse`, `--focus-ring`                                                                                                          |
| Brand    | `--accent`, `--accent-hover`, `--accent-press`, `--accent-tint`, `--accent-fg`; same five for `--anchor`                                                                   |
| Ramps    | `--ink-0` … `--ink-1000`, `--signal-50` … `--signal-900`                                                                                                                   |
| Status   | `--status-success`, `--status-warning`, `--status-danger`, `--status-info`                                                                                                 |
| Space    | `--space-0` … `--space-15`, `--space-px`, `--gutter`                                                                                                                       |
| Type     | `--font-sans`, `--font-display`, `--font-mono`; `--fs-3xs` … `--fs-8xl`; `--fw-light` … `--fw-black`; `--lh-tight/snug/normal/relaxed`; `--tr-tight/snug/normal/wide/caps` |
| Radius   | `--radius-none/xs/sm/md/lg/xl/pill`                                                                                                                                        |
| Shadow   | `--shadow-xs` … `--shadow-xl`, `--shadow-focus`, `--shadow-inset`                                                                                                          |
| Layout   | `--container-sm` … `--container-2xl`                                                                                                                                       |
| Motion   | `--dur-instant/fast/normal/slow`, `--ease-out`, `--ease-in-out`, `--ease-spring`                                                                                           |
| Layering | `--z-base/raised/sticky/overlay/modal/toast/tooltip`                                                                                                                       |

### Compound components

Several components are namespaced sets of exports, not single elements —
compose the parts rather than passing content as props:

- `Card` + `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter`
- `Dialog` + `DialogTrigger` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` / `DialogFooter` / `DialogClose`
- `Tabs` + `TabsList` / `TabsTrigger` / `TabsContent`
- `Toast` + `Toaster` / `useToast` / `ToastTitle` / `ToastDescription` / `ToastAction`

### Layout patterns are NOT components

Header, Footer, Hero, Sidebar, and TopBar are **app-level compositions, not
packaged primitives** — there is no `<Header>` to import. Build them from the
primitives (`Button`, `Badge`, `Eyebrow`, `RuleLink`, `Card`, `Separator`,
`NavigationMenu`) plus your own layout CSS using the tokens above.

### Where the truth lives

Before styling anything, read the real files — they beat any summary:

- `styles.css` and its `@import` closure (`tokens/tokens.css`, `_ds_bundle.css`)
  — the authoritative token values and component CSS.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage and variants.
- `components/<group>/<Name>/<Name>.d.ts` — the exact prop contract.

### An idiomatic example

Library components for the controls; tokens for the glue around them.

```jsx
const { Card, CardHeader, CardTitle, CardDescription, CardContent, Eyebrow, Badge, Button } =
  window.MiltinsonDS;

<section
  style={{
    maxWidth: 'var(--container-lg)',
    margin: '0 auto',
    padding: 'var(--space-12) var(--gutter)',
  }}
>
  <Eyebrow>Miltinson Technologies</Eyebrow>
  <h2
    style={{
      font: `var(--fw-semibold) var(--fs-4xl)/var(--lh-tight) var(--font-display)`,
      color: 'var(--fg)',
      margin: 'var(--space-3) 0 var(--space-8)',
    }}
  >
    Practical AI consulting
  </h2>

  <div
    style={{
      display: 'grid',
      gap: 'var(--space-5)',
      gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
    }}
  >
    <Card>
      <CardHeader>
        <Badge variant="signal">Featured</Badge>
        <CardTitle>Kids Recipes</CardTitle>
        <CardDescription>Simple, fun recipes designed for kids.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="accent">Hire Me</Button>
      </CardContent>
    </Card>
  </div>
</section>;
```
