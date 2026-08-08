# Build the Miltinson Design System documentation site

You are working in the git worktree at `/Users/elirobinson/Code/design-system-docs-site`,
on branch `feat/docs-site`. It is a full checkout of the design-system monorepo with a
clean tree. Everything below describes work to do there.

This is a single long autonomous run. Plan it yourself, work through it without
check-ins, and read the "How to work" section at the end before you start — it is the
operating contract for the run, not boilerplate.

---

## Intent

`@elirobinson/tokens`, `@elirobinson/react`, and `@elirobinson/ai-patterns` are a real,
published design system. Right now the only way to see it running is Storybook, which is
a component workbench — it shows a component in isolation but says nothing about when to
reach for it, what the system believes about color or spacing, or how to adopt it in an
app.

Build the missing piece: a documentation site that stands next to Polaris, Primer, and
shadcn/ui in seriousness. Two audiences use it, and both matter equally:

- **A developer** landing on it cold should be able to install the packages, understand
  the foundations, find the right component, copy a working example, and know the
  accessibility contract they're inheriting.
- **A coding agent** pointed at it should be able to fetch a machine-readable description
  of the whole system, or of one component, and write correct code against it without
  guessing at import paths or prop names.

The second audience is not an afterthought. A design system that agents can't read
correctly is a design system that gets used incorrectly at scale.

---

## Repository ground truth

Facts about the repo as it stands. Verify anything here that affects your work — this is
orientation, not a substitute for reading the code.

**Stack.** pnpm 10.11.1 workspaces, Nx 22.7, TypeScript, React 19, Vite 8. Node >= 24.

**Packages.**

| Path                                        | Package                    | Contents                                                              |
| ------------------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| `packages/tokens`                           | `@elirobinson/tokens`      | `tokens.css` (CSS custom properties), `tokens.json`, `tokens-data.ts` |
| `packages/react`                            | `@elirobinson/react`       | 44 components, 5 hooks, per-component CSS                             |
| `packages/ai-patterns`                      | `@elirobinson/ai-patterns` | `patterns.md`, `contracts.json`                                       |
| `packages/create-elirobinson-design-system` | —                          | `npx` starter generator (scaffolds Next.js App Router)                |
| `apps/storybook`                            | —                          | Storybook 10, 45 stories, aliases packages to source                  |

**Components** (`packages/react/src/components/<tier>/<Name>.tsx`):

- **atoms** — Avatar, Badge, Button, Checkbox, Eyebrow, Input, Kbd, Label, Progress,
  RadioGroup, Separator, Skeleton, Slider, Spinner, Switch, Textarea
- **molecules** — Alert, Breadcrumb, Card, Chip, EmptyState, FormField, Pagination,
  Rating, RuleLink, SearchField, SegmentedControl, Stepper
- **organisms** — Accordion, Combobox, CommandPalette, DatePicker, Dialog, DropdownMenu,
  NavigationMenu, Popover, Select, Sheet, Table, Tabs, Toast, Tooltip, VirtualList,
  VirtualTable

**Hooks** (`packages/react/src/hooks/`): `useActiveDescendant`, `useAnchoredPosition`,
`useClickOutside`, `useEscapeKey`, `useRovingFocus`.

**Import convention — this one is strict.** There are no barrel files. Consumers import
via package subpaths and nothing else:

```tsx
import '@elirobinson/tokens/tokens.css';
import '@elirobinson/react/styles.css';
import { Button } from '@elirobinson/react/components/atoms/Button';
import { useRovingFocus } from '@elirobinson/react/hooks/useRovingFocus';
```

See `.cursor/rules/no-barrel-files.mdc`. Every example you write and every import path you
publish in the AI artifacts must follow this. An import from `@elirobinson/react` bare is
wrong and will not resolve.

**Styles.** Each component's CSS sits beside it. `packages/react/src/styles.css` is the
aggregate entry point and its `@import` order is the cascade order — treat that order as
load-bearing. Consumers can also import a single sheet via
`@elirobinson/react/styles/<tier>/<Name>.css`.

**Tokens.** Roughly 120 semantic custom properties on `:root`, in these families: base
color scale (`--ink-*`, `--signal-*`), semantic color (`--bg`, `--fg`, `--surface`,
`--border`, `--accent-*`, `--anchor-*`, `--status-*`, `--link*`, `--focus-ring`),
type (`--font-*`, `--fs-*`, `--fw-*`, `--lh-*`, `--tr-*`), spacing (`--space-*`, 4px base),
radii (`--radius-*`, sharp by default), shadow (`--shadow-*`, restrained), motion
(`--dur-*`, `--ease-*`), and layout (`--container-*`, `--gutter`, `--z-*`).

Two wrinkles worth knowing: the base-color comment block in `tokens.css` still says
"electric lime" from an earlier palette, but the signal color is **Miltinson Amber** — the
values are right, the comment is stale. And `tokens.css` pulls Geist and JetBrains Mono
from Google Fonts via `@import`.

**Existing prose to reuse, not duplicate.** `docs/agents/` holds topic guides
(`components.md` is substantial and authoritative — tier boundary rule, touch-target
policy, shadcn mapping table, `FormField` vs `Input`), `README.md` has the component
inventory tables and the GitHub Packages install flow, and `design-system-docs/` holds the
brand source of truth: `SKILL.md`, `README.md`, `colors_and_type.css`, `assets/` (logo
lockup, wordmark, mark, dot-grid pattern), `preview/` (canonical HTML swatches for
buttons, cards, fields, tags, type, spacing, radii), `ui_kits/`, and `slides/`.

Read `design-system-docs/README.md` and `SKILL.md` before you design a single screen. The
site must look like it belongs to this brand, not like a generic docs theme.

**Brand rules, condensed** (the full set is in `design-system-docs/`): Eli speaks as "I",
never "we". Tone is practical, honest, warm, no-fluff. Ink-led with Miltinson Amber as the
only loud accent, Forest as secondary anchor. Geist + JetBrains Mono. Wordmark is
"Miltinson." with the amber period. No gradients, no purple, no emoji in primary UI. Sharp
4–6px radii, hairline borders, restrained shadows, calm motion. Accessibility-first: 16px
minimum text, WCAG AA, visible focus rings, `prefers-reduced-motion` honored.

**Verification commands** (from the repo root):

```bash
pnpm install
pnpm build        # nx run-many -t build
pnpm lint         # eslint .
pnpm typecheck    # tsc --noEmit -p ./tsconfig.typecheck.json
pnpm test         # nx run-many -t test
pnpm format:check # prettier --check .
```

Husky + lint-staged run Prettier on commit. `.prettierrc` and `eslint.config.mjs` are the
authorities on style — match them rather than introducing new conventions.

---

## What done looks like

### The site

A Next.js App Router application at `apps/docs`, wired into Nx the way `apps/storybook` is
(a `project.json` with `dev` / `build` / `lint` / `test` targets and
`implicitDependencies: ["react", "tokens"]`). Content in MDX. It takes
`@elirobinson/react` and `@elirobinson/tokens` as **workspace dependencies** so the site
always renders the current source — the published-package install flow is documented on
the installation page, but is not how the site itself consumes the system.

Structure:

- **Overview** — a landing page that states what the system is and what it believes;
  installation, including the real GitHub Packages `.npmrc` + PAT flow and the
  `npx create-elirobinson-design-system` generator; and an adoption guide for bringing an
  existing app onto the system.
- **Foundations** — color, typography, spacing, radii and elevation, motion,
  accessibility. Each page renders live token values pulled from `@elirobinson/tokens`
  rather than hardcoded swatches, so the page cannot drift from the package. Color pages
  must show contrast ratios and mark which pairings pass AA.
- **Components** — one page per component, all 44, grouped by tier. Each page carries a
  live interactive preview, a variant gallery covering the real prop surface, a
  generated props table, the exact import subpath, an accessibility section stating the
  keyboard contract and ARIA pattern, do/don't guidance, and links to related components.
- **Patterns** — the compositions that aren't shipped as components: Header, Footer, Hero,
  Sidebar, TopBar, plus form layout and data-display patterns. `docs/agents/layout-patterns.md`
  and `design-system-docs/ui_kits/` are the sources. Be explicit that these are recipes to
  compose from primitives, not importable components.
- **Guidelines** — voice and content, the accessibility standard, the atomic-tier boundary
  rule, and how to contribute a component (including the shadcn-adoption policy from
  `docs/agents/components.md`).
- **Build with AI** — see below.

Every code example must be copy-pasteable and correct. If an example imports it, that
import path resolves. Prefer generating examples from real component source over
hand-writing snippets that can rot.

### The extraction pipeline

This is the part that determines whether the site stays honest, so treat it as
architecture rather than tooling.

A single build-time step walks `packages/react/src/components/**` and emits one
`component-manifest.json`: for each component, its name, tier, import subpath, stylesheet
subpath, prop table (name, type, required, default, description), sub-components, and the
constraints that apply to it.

That manifest is the only source for **three** consumers: the rendered props tables, the
site search index, and the AI artifacts below. Nothing downstream may hand-maintain a
second copy of this data. The property that matters: adding a component or changing a prop
in `packages/react` propagates everywhere without anyone editing docs by hand, so the AI
surface cannot silently drift from the code.

`react-docgen-typescript` is the obvious extractor. If it can't handle a component's prop
types cleanly, fix the extraction or record the gap in the manifest — do not paper over it
with a hand-written table.

### The AI layer

- **`/llms.txt`** — a concise route-handler-generated index of the system: what it is,
  install line, and every component with its import subpath and one-line purpose.
- **`/llms-full.txt`** — the full corpus: foundations, every component with its complete
  prop table and constraints, and the patterns. One file an agent can be handed wholesale.
- **`/r/[component].json`** — per-component machine-readable records, so an agent can
  fetch one component instead of the whole corpus.
- **Prompt templates**, written into `packages/ai-patterns/src/prompts/` so they ship with
  the published package and are versioned, then rendered on the site's "Build with AI"
  section. At minimum: adding a new component to the system, adopting the design system in
  an existing app, and auditing a page for token and accessibility compliance. Each
  follows the existing house style in `patterns.md` — intent, constraints, verification
  checklist.
- **`packages/ai-patterns/src/contracts.json` extended** so the constraints that currently
  live only in prose become machine-checkable: the scoped touch-target policy (44×44 for
  primary controls, shadcn/MUI dense scale for inline affordances, hit areas never
  overlapping siblings), the `forwardRef` requirement, the tier boundary rule, and the
  no-barrel-files import convention. Keep the existing keys working; extend, don't replace.
- **`design-system-docs/SKILL.md`** gains a pointer to the live site so the brand skill and
  the docs site reference each other.

### Green

`pnpm install && pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm format:check`
all pass from the repo root, with `apps/docs` included in the Nx graph. `llms.txt` and
`llms-full.txt` are non-empty and their import paths are real. The site builds to a
production bundle without errors.

---

## Non-goals

Do not do these, even if they look like improvements:

- **Don't modify component source** in `packages/react/src/components/`. If a component's
  types are too loose to document well, record it in your notes and keep going — changing
  the library is a separate piece of work with its own review.
- **Don't add Tailwind**, a CSS-in-JS runtime, or a third-party docs framework
  (Fumadocs, Nextra, Starlight). The site is styled with the design system's own tokens
  and components. Dogfooding is the point.
- **Don't restyle or restructure `apps/storybook`.** It keeps its current job. Link to it
  from the docs site; leave it alone otherwise.
- **Don't publish anything, bump versions, or add changesets.**
- **Don't reorganize `docs/agents/` or `design-system-docs/`.** Read them, link to them,
  reuse their prose. The one exception is the `SKILL.md` cross-link named above.
- **Don't add error handling, abstractions, or configuration for cases that can't happen.**
  A docs site does not need a plugin architecture.

---

## How to work

Operate autonomously. Nobody is watching in real time and nobody can answer a question
mid-run, so asking "shall I proceed?" will simply block the work. For reversible actions
that follow from this brief, proceed without asking.

Take the whole brief above as the specification and plan it yourself. You do not need to
follow the order it's written in — the order that gets to a verifiable site fastest is
better than the order that reads well in a document.

**Establish a way to check your own work before you need it, and run it on a cadence.**
The build, lint, typecheck, and test commands are listed above; a docs site also needs to
actually render, so get a production build and a smoke check of real pages working early
and re-run them as you go. Finding out at the end that half the component pages throw is
the failure mode to design against.

**Delegate independent tracks to sub-agents and keep working while they run.** Documenting
44 components is genuinely parallelizable once the page template and the manifest exist;
foundations, patterns, and the AI artifacts are independent of each other. Brief each
sub-agent precisely the first time, and don't re-derive its findings when it reports back.
Intervene if one goes off track or is missing context. Verification belongs in your own
loop, not in a sub-agent.

**Keep a `NOTES.md` in the worktree root as you go** — one entry per decision or
correction, with a one-line summary and why it mattered. Record things a future session
would otherwise have to rediscover: a component whose types resisted extraction, a token
whose name doesn't match its comment, a choice you made between two reasonable
approaches. Don't record what the repo or git history already says. This file is scratch
for the run, not a deliverable — but it is what makes the run auditable.

**Before reporting progress, audit each claim against a tool result from this session.**
Only report work you can point to evidence for. If something isn't verified yet, say so
plainly. If tests fail, say so with the output; if you skipped something, say that. When
something is done and verified, state it plainly without hedging.

Don't add features, refactor, or introduce abstractions beyond what this brief requires. A
one-off transform doesn't need a helper, and a docs page doesn't need a framework. Do the
simplest thing that works well, and don't leave half-finished implementations behind.

**When you finish, write the summary for someone who saw none of this.** Lead with the
outcome — what exists now and whether it verifies green. Then the things they need to
decide or know: what you couldn't do and why, any gap you recorded, and how to run the
site. Spell out file paths and commands in full rather than referring to shorthand you
invented while working. Complete sentences, no arrow chains, no abbreviations they'd have
to decode.
