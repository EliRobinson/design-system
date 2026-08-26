# @elirobinson/eslint-config

The statically checkable half of the Miltinson design system's contracts, as a flat ESLint
config. Every rule it turns on corresponds to an entry in
`@elirobinson/ai-patterns/contracts` that names it in `verifiedBy`, so lint failures and
the documented contracts are the same list read from two directions.

**This README documents the option surface, not the rules.** For what is enforced and what
each rule verifies, run `pnpm ds contracts` against the version you have installed — a list
written down here would be wrong as of the next release.

```bash
pnpm add -D @elirobinson/eslint-config
```

```js
// eslint.config.mjs
import designSystem from '@elirobinson/eslint-config';

export default [
  // …your existing config
  ...designSystem(),
];
```

## `designSystem(options)`

Returns flat config objects: one carrying the rules, plus a second that relaxes the direct
primitive ban inside the gap-filler globs.

| Option            | Default                     | What it does                                                      |
| ----------------- | --------------------------- | ----------------------------------------------------------------- |
| `gapFiller`       | `['**/components/ui/**']`   | Globs where a sanctioned gap-filler lives — see below             |
| `files`           | all JS/TS source extensions | Which files the config applies to                                 |
| `severity`        | `'error'`                   | Severity for every rule **except** the copy rule — see below      |
| `hardcodedValues` | `{}`                        | Options forwarded to `no-hardcoded-design-values`                 |
| `copy`            | `{}`                        | Options forwarded to `no-padded-ui-copy`, plus its own `severity` |

`gapFiller` names where shadcn/ui output (or its equivalent) lives. Direct primitive
imports are allowed there and every other ban still applies; pass `[]` to drop the second
config object entirely.

Rule options are forwarded to the rules themselves, so `pnpm ds contracts` and the rule
sources are the authority on what each accepts; this table names the keys, not their
semantics.

### `copy.severity` is separate from `severity`, deliberately

`copy.severity` defaults to `'warn'` and does **not** inherit the top-level `severity`. It
has to be set explicitly:

```js
...designSystem({ copy: { severity: 'error' } });
```

Every repo that upgrades into `no-padded-ui-copy` has UI copy written before the rule
existed, and a rule that red-builds a consumer on upgrade gets deleted rather than worked
through. Shipping it at `warn` is what makes the upgrade survivable; letting it inherit a
top-level `'error'` would undo that for every consumer who never asked for it.

That protection is for the upgrade, which happens once. **Raise it to `'error'` as soon as
the repo lints clean under it** — at `warn` the rule observes that the copy is clean, at
`error` it keeps it that way. It is a line in the **Definition of Done for UI work** that
`pnpm ds patterns` prints. `'off'` also works, if a repo has decided against the rule.

## `designSystem` is also the default export

`import designSystem from '@elirobinson/eslint-config'` and
`import { designSystem } from '@elirobinson/eslint-config'` are the same function.

## `@elirobinson/eslint-config/css`

The contracts that can only be settled by reading a stylesheet, in their own entry point
because they need `@eslint/css` — an optional peer that registers a second ESLint language.
Importing the package root never loads it, so a consumer who only lints JS/TSX pays nothing.

```js
import designSystemCss from '@elirobinson/eslint-config/css';

export default [...designSystem(), ...designSystemCss()];
```

| Option     | Default        | What it does                                                                                                |
| ---------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| `files`    | `['**/*.css']` | Which stylesheets to lint.                                                                                  |
| `ignores`  | `[]`           | Stylesheets that _define_ values rather than consume them — your own token layer, vendored third-party CSS. |
| `severity` | `'error'`      | Severity for every rule in this config.                                                                     |

Point `ignores` at any sheet that legitimately declares literals. A token file that is
linted as if it were a consumer of tokens fails on every line it exists to write.

## `mcpStdio(files)`

A single config object for packages that serve MCP over stdio, where stdout is the JSON-RPC
channel: one `console.log` anywhere in the process emits a line the host cannot parse and
the connection drops, silently and totally. It allows `console.error` only — even
`console.warn` is banned, so a reader never has to remember which methods write where.

```js
import { mcpStdio } from '@elirobinson/eslint-config';

export default [...designSystem(), mcpStdio(['packages/my-server/src/**/*.mjs'])];
```

## `plugin`

The rule plugin itself, exported from the package root and from
`@elirobinson/eslint-config/plugin`, for a repo that wires the rules into its own config
rather than spreading `designSystem()`. The CSS entry point exports its own `plugin` — a
second, separate one, because those rules run under the CSS language.

## What this config cannot check

Touch targets, visible focus, and contrast are settled by a browser, not by a parser. They
ship as Playwright helpers in `@elirobinson/ai-patterns/testing/playwright`, and
`pnpm ds contracts` marks which constraints land on which side.
