/**
 * The whole modification layer for the vendored AI Elements source.
 *
 * Every difference between an upstream file and the copy in
 * `packages/ai-elements/src/` is produced here, deterministically, from the
 * upstream bytes. Nothing is hand-edited, which is what makes a re-sync
 * reviewable: `pnpm sync:elements` re-derives the expected vendored content
 * from fresh upstream bytes and compares it to what is on disk, so a diff is
 * always either "upstream changed" or "somebody edited a vendored file", never
 * an untracked mix of the two.
 *
 * Keep this list short. A rule here is applied to 74 files and is re-applied on
 * every bump; a rule that cannot be stated in one sentence belongs in a wrapper
 * component in our own source instead, where it is ours and upstream never
 * touches it.
 */
import { posix } from 'node:path';

import * as skin from './ai-elements-patches/skin.mjs';
import { applyA11yPatches } from './ai-elements-patches/a11y.mjs';

/**
 * Upstream is a pnpm monorepo, so its components import their shadcn/ui
 * primitives through a workspace package name. We vendor both tiers into one
 * published package, so those specifiers have to become paths inside it.
 */
const WORKSPACE_ALIAS = '@repo/shadcn-ui/';

/**
 * Upstream writes relative specifiers extensionless, because its own build is a
 * bundler's. Adding the extension keeps the emitted dist/ resolvable by Node as
 * well as by a bundler — the same property `@elirobinson/react` gets from
 * NodeNext, which this package cannot use (see its tsconfig.json).
 */
const RELATIVE_EXTENSION = '.js';

// `from "x"`, `import "x"`, `export ... from "x"`, and the type-only forms.
// Deliberately anchored to a specifier position: a bare /["']…["']/ sweep also
// rewrites string literals that merely look like paths.
const SPECIFIER_RE = /(\bfrom\s*|\bimport\s*|\brequire\(\s*)(["'])([^"'\n]+)\2/g;

/**
 * Where an upstream path lands in `packages/ai-elements/src/`.
 * Returns null for a path we do not vendor.
 */
export function targetFor(upstreamPath) {
  const element = /^packages\/elements\/src\/([a-z0-9-]+)\.tsx$/.exec(upstreamPath);
  if (element) {
    return `src/components/${element[1]}.tsx`;
  }

  const ui = /^packages\/shadcn-ui\/components\/ui\/([a-z0-9-]+)\.tsx$/.exec(upstreamPath);
  if (ui) {
    return `src/ui/${ui[1]}.tsx`;
  }

  const lib = /^packages\/shadcn-ui\/(lib|hooks)\/([a-z0-9-]+)\.(ts|tsx)$/.exec(upstreamPath);
  if (lib) {
    return `src/${lib[1]}/${lib[2]}.${lib[3]}`;
  }

  return null;
}

/**
 * The reverse: which upstream file a `@repo/shadcn-ui/...` specifier names.
 * Upstream writes them extensionless, and the two tiers use different
 * extensions, so the caller passes the set of paths it actually fetched.
 */
export function resolveWorkspaceSpecifier(specifier, upstreamPaths) {
  const bare = `packages/shadcn-ui/${specifier.slice(WORKSPACE_ALIAS.length)}`;
  return [`${bare}.tsx`, `${bare}.ts`].find((candidate) => upstreamPaths.has(candidate)) ?? null;
}

function relativeSpecifier(fromTarget, toTarget) {
  const rel = posix
    .relative(posix.dirname(fromTarget), toTarget)
    .replace(/\.tsx?$/, RELATIVE_EXTENSION);
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/**
 * The ordered rule list. Each entry reports whether it fired, so a file's
 * header names only the modifications that file actually carries.
 */
const RULES = [
  {
    id: 'workspace-alias',
    describe: 'rewrote @repo/shadcn-ui/* imports to paths inside this package',
    apply(source, ctx) {
      let fired = false;
      const out = source.replace(SPECIFIER_RE, (match, keyword, quote, specifier) => {
        if (!specifier.startsWith(WORKSPACE_ALIAS)) {
          return match;
        }

        const upstreamPath = resolveWorkspaceSpecifier(specifier, ctx.upstreamPaths);
        if (!upstreamPath) {
          throw new Error(
            `${ctx.upstreamPath}: imports "${specifier}", which resolves to no vendored file. ` +
              'Upstream added a primitive the closure walk did not pick up.',
          );
        }

        fired = true;
        return `${keyword}${quote}${relativeSpecifier(ctx.target, targetFor(upstreamPath))}${quote}`;
      });

      return { source: out, fired };
    },
  },
  {
    id: 'relative-extensions',
    describe: `appended ${RELATIVE_EXTENSION} to relative specifiers, so dist/ resolves under Node too`,
    apply(source) {
      let fired = false;
      const out = source.replace(SPECIFIER_RE, (match, keyword, quote, specifier) => {
        if (!specifier.startsWith('.') || posix.extname(specifier) !== '') {
          return match;
        }

        fired = true;
        return `${keyword}${quote}${specifier}${RELATIVE_EXTENSION}${quote}`;
      });

      return { source: out, fired };
    },
  },
  /* The accessibility layer, and the one rule here that is a judgement rather
     than a mechanism.
     It is last on purpose. Every rule above rewrites import specifiers; this one
     rewrites className strings and JSX attributes, and running it after them
     means its anchors never have to account for a specifier that has already
     moved. It is also the only rule that can fail: its anchors are exact, and a
     missing one throws rather than silently not applying — see the file's header
     for why that is the safe direction.
     Everything about WHICH control gets which floor, and why, lives in that one
     file rather than being spread across this list. The rest of this module
     stays what it was: two mechanical rules stated in a sentence each. */
  {
    id: 'a11y-touch-targets',
    describe:
      'applied the design system touch-target contracts — a var(--target) floor for primary controls, ' +
      'and a data-touch-target="dense" classification for compact inline affordances ' +
      '(see scripts/ai-elements-patches/a11y.mjs for the per-control verdicts)',
    apply(source, ctx) {
      return applyA11yPatches(source, ctx.upstreamPath);
    },
  },

  // --- The skin -------------------------------------------------------------
  // Last, and the only rule here about how a component LOOKS rather than about
  // where it imports from. Ordering is not delicate — it edits class lists and
  // a module specifier is not one — but last is where a presentational rule
  // belongs, after the file is structurally what this package needs.
  //
  // Its scope is deliberately small. `@elirobinson/tokens/tailwind.css` already
  // maps Tailwind's colour, radius, shadow and font namespaces onto the tokens
  // with `@theme inline`, so `bg-background`, `text-muted-foreground`,
  // `border-border` and `rounded-md` compile to `var(--token)` and answer to
  // every dial at runtime: almost the whole vendored tree is on-brand untouched.
  // This rule reaches only the residue the bridge cannot — Tailwind's own
  // palette literals, which nothing re-points, and shadcn's `--accent`, which
  // means "subtle hover tint" upstream and "Miltinson Amber" here.
  //
  // The tables and the colour-by-colour reasoning live in the module rather than
  // in this list, which is meant to stay readable at a glance.
  { id: skin.id, describe: skin.describe, apply: skin.apply },
];

function header({ upstreamPath, upstream, applied }) {
  const modifications =
    applied.length === 0
      ? [' *   (none — byte-identical to upstream below the header)']
      : applied.map((rule) => ` *   - ${rule.id}: ${rule.describe}`);

  return [
    '/*',
    ' * Vendored from vercel/ai-elements. DO NOT EDIT BY HAND.',
    ' *',
    ` * Upstream:  https://github.com/${upstream.repo}`,
    ` * Release:   ${upstream.ref} (${upstream.commit})`,
    ` * Source:    ${upstreamPath}`,
    ' * License:   Apache-2.0. See LICENSE and NOTICE at this package root.',
    ' *',
    ' * Local modifications, applied by scripts/ai-elements-transforms.mjs:',
    ...modifications,
    ' *',
    ' * Re-pull with `pnpm sync:elements`. An edit made here instead is detected',
    ' * as local divergence and makes the next upstream bump fail loudly rather',
    ' * than silently reverting your change.',
    ' */',
    '',
  ].join('\n');
}

/**
 * upstreamSource -> the exact bytes that belong at `target`.
 * Pure: same inputs, same output, which is the property the sync check rests on.
 */
export function vendor({ upstreamPath, source, upstream, upstreamPaths }) {
  const target = targetFor(upstreamPath);
  if (!target) {
    throw new Error(`No vendor target for upstream path ${upstreamPath}`);
  }

  const ctx = { upstreamPath, target, upstreamPaths };
  const applied = [];
  let current = source;

  for (const rule of RULES) {
    const result = rule.apply(current, ctx);
    current = result.source;

    if (result.fired) {
      applied.push(rule);
    }
  }

  return { target, content: header({ upstreamPath, upstream, applied }) + current };
}

export const ruleIds = RULES.map((rule) => rule.id);
