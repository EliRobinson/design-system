// One check per trap that reached this repo as a consumer issue with no error
// behind it: the app looked wrong, and nothing said why. Each check reads the
// consumer's files and the INSTALLED packages, never a bundled copy, so it
// describes the versions the app actually runs.
//
// A check returns findings, never throws, and stays quiet when it cannot tell.
// A warning a consumer learns to ignore is worse than no warning.
//
// Checks about how the app USES the design system (fonts, container widths)
// run only when a stylesheet or script imports it. Checks about what is IN the
// repo (a layered token, a copied stylesheet, a stale record, an old install)
// run regardless: those files are wrong whoever imports what.
//
// Adding a trap: add an entry to TRAPS, and a fixture under __fixtures__/ that
// trips it and nothing else. check.test.mjs fails until both exist.

import { join } from 'node:path';

import { DLX } from '../../artifacts/llms.mjs';
import { checkRecordDrift, RECORD_PATH, REGENERATE_ARTIFACTS } from '../../resync/artifacts.mjs';
import { positionAt } from '../../resync/scan.mjs';
import { compareVersions, parseVersion } from '../../resync/semver.mjs';
import { cssVariables, REACT_PKG, readFile, TOKENS_PKG } from '../discovery.mjs';
import { declarations, DS_STYLESHEETS } from './scan.mjs';

/**
 * @typedef {import('./scan.mjs').ScannedFile} ScannedFile
 *
 * @typedef {object} CheckContext
 * @property {string} root consumer repo root
 * @property {object} env what `loadEnvironment` found installed for that root
 * @property {ScannedFile[]} css the repo's stylesheets
 * @property {ScannedFile[]} source the repo's scripts
 * @property {object} record `.claude/ds-artifacts.json`, or `{ files: {} }`
 * @property {boolean} usesDesignSystem a stylesheet or script imports DS_STYLESHEETS
 * @property {boolean} usesTailwind a stylesheet imports `tailwindcss` (v4)
 * @property {string | undefined} entryStylesheet the stylesheet that imports the design system
 *
 * @typedef {object} Finding
 * @property {string[]} where one line per place
 * @property {string[]} what what goes wrong, in plain words
 * @property {string[]} fix the exact change; indented lines are code
 * @property {number[]} [issues] replaces the trap's own `issues` for this finding
 *
 * @typedef {{ id: string, issues: number[], run: (context: CheckContext) => Finding[] }} Trap
 */

/** Where-lists longer than this are cut, with a count of the rest. */
const MAX_WHERE = 8;

function capped(lines) {
  if (lines.length <= MAX_WHERE) return lines;
  return [...lines.slice(0, MAX_WHERE), `...and ${lines.length - MAX_WHERE} more`];
}

/* ---------------------------------------------------------------- fonts */

const NEXT_FONT = /from\s+['"](next\/font\/(?:google|local)|geist\/font(?:\/[\w-]+)?)['"]/;

/** Sets the hook, in a stylesheet or a style object. Reading it with var() does not count. */
const SETS_SANS_OVERRIDE = /--ds-font-sans-override['"]?\s*:/;

/**
 * The `--ds-font-*-override` lines to suggest, from the `variable:` names the
 * app gave next/font. A placeholder when no name says which family it is.
 */
function overrideLines(fontFiles) {
  const variables = fontFiles.flatMap((file) =>
    [...file.masked.matchAll(/variable:\s*['"](--[\w-]+)['"]/g)].map((match) => match[1]),
  );
  const geistPackage = fontFiles.some((file) => /from\s+['"]geist\/font/.test(file.masked));
  const pick = (pattern) => variables.find((name) => pattern.test(name));

  const mono = pick(/mono/) ?? (geistPackage ? '--font-geist-mono' : undefined);
  const display = pick(/display|serif|heading/);
  const sans =
    pick(/sans/) ??
    variables.find((name) => name !== mono && name !== display) ??
    (geistPackage ? '--font-geist-sans' : '--your-font-variable');

  return [
    `    --ds-font-sans-override: var(${sans});`,
    ...(display ? [`    --ds-font-display-override: var(${display});`] : []),
    ...(mono ? [`    --ds-font-mono-override: var(${mono});`] : []),
  ];
}

/** #34. `next/font` gives the family a generated name, so tokens.css's literal 'Geist' never reaches it. */
function fontOverride(context) {
  if (!context.usesDesignSystem) return [];
  const fontFiles = context.source.filter((file) => NEXT_FONT.test(file.masked));
  if (fontFiles.length === 0) return [];

  const setsOverride = [...context.css, ...context.source].some((file) =>
    SETS_SANS_OVERRIDE.test(file.masked),
  );
  if (setsOverride) return [];

  return [
    {
      where: fontFiles.map(
        (file) =>
          `${file.path} loads a font with next/font, and no file sets --ds-font-sans-override`,
      ),
      what: [
        'next/font gives the font a generated name. tokens.css asks for "Geist" by',
        'its real name, so the font next/font loaded is never used. Text renders in',
        "the design system's own Geist files, or in the system font before",
        `${TOKENS_PKG} 0.7.1. A different typeface never shows. Nothing errors.`,
      ],
      fix: [
        `Add this to ${context.entryStylesheet ?? 'your entry stylesheet'}, outside any @layer:`,
        '',
        '  :root {',
        ...overrideLines(fontFiles),
        '  }',
        '',
        "Put each font's `variable` class on <html>, so the variable exists at :root.",
      ],
    },
  ];
}

/* ------------------------------------------------------ layers */

/** Selectors tokens.css and palettes.css set tokens on. An override anywhere else has nothing to lose to. */
const TOKEN_SCOPE = /^(?::root|html|:host)\b|^\.dark\b|^\[data-(?:theme|palette)\b/;

/**
 * The layer that hides a declaration from the page, or undefined. `@theme`
 * always writes to :root; `@layer` only loses where tokens.css also declares.
 */
function hidingLayer(blocks) {
  const theme = blocks.find((prelude) => /^@theme\b/.test(prelude));
  if (theme) return theme;

  const layer = blocks.find((prelude) => /^@layer\b/.test(prelude));
  const selector = blocks.findLast((prelude) => !prelude.startsWith('@'));
  if (!layer || !selector) return undefined;
  const onTokenScope = selector.split(',').some((part) => TOKEN_SCOPE.test(part.trim()));
  return onTokenScope ? layer : undefined;
}

/** #34's second cause. A token re-declared inside a cascade layer loses to the unlayered tokens.css. */
function layeredTokenOverride(context) {
  const sheets = context.env.tokenStylesheets;
  if (!sheets) return [];
  const tokens = new Set(cssVariables(sheets).map(({ name }) => name));

  const where = [];
  for (const file of context.css) {
    for (const { name, index, blocks } of declarations(file.masked)) {
      if (!tokens.has(name)) continue;
      const layer = hidingLayer(blocks);
      if (!layer) continue;
      const { line } = positionAt(file.text, index);
      where.push(`${file.path}:${line} sets ${name} inside ${layer}`);
    }
  }
  if (where.length === 0) return [];

  return [
    {
      where: capped(where),
      what: [
        'tokens.css declares its tokens outside any layer. A declaration outside a layer',
        'beats every declaration inside one, so these overrides never apply.',
        '@theme compiles into @layer theme, so it loses the same way.',
      ],
      fix: [
        'Move each one into a plain `:root { ... }` rule, outside any @layer or @theme,',
        'after the design system import. For a font family, set',
        '--ds-font-sans-override (or -mono-, -display-) instead of --font-sans.',
      ],
    },
  ];
}

/** The design system imported into a cascade layer, which puts Preflight or utilities on the wrong side of it. */
function layeredImport(context) {
  const layered = context.css.flatMap((file) =>
    file.imports
      .filter((entry) => DS_STYLESHEETS.includes(entry.specifier) && /\blayer\b/.test(entry.tail))
      .map((entry) => ({ file, entry })),
  );
  if (layered.length === 0) return [];

  return [
    {
      where: layered.map(
        ({ file, entry }) => `${file.path}:${entry.line} imports ${entry.specifier} ${entry.tail}`,
      ),
      what: [
        'The design system is built to sit outside every cascade layer. Inside one,',
        "layer order wins over selectors: a layer before Tailwind's base lets",
        "Preflight reset every component's margin, padding and border, and a layer",
        'after utilities makes Tailwind utilities stop working on components.',
      ],
      fix: [
        'Remove `layer(...)` from the import:',
        '',
        `  @import '${layered[0].entry.specifier}';`,
      ],
    },
  ];
}

/* ------------------------------------------------------- Tailwind sizes */

/** Tailwind v4's own values for the five names tokens.css re-declares. */
const TAILWIND_CONTAINER = { sm: '24rem', md: '28rem', lg: '32rem', xl: '36rem', '2xl': '42rem' };

const CONTAINER_UTILITY =
  /(?<![\w-])(?:[\w-]+:)*(max-w|min-w|w|basis|inline|columns)-(sm|md|lg|xl|2xl)(?![\w-])/g;

/** #250. tokens.css's unlayered `--container-*` replaces Tailwind's, so `max-w-md` is not 448px. */
function containerWidths(context) {
  if (!context.usesDesignSystem || !context.usesTailwind) return [];
  const ours = cssVariables(context.env.tokenStylesheets ?? []).find(
    ({ name }) => name === '--container-md',
  );
  if (!ours) return [];

  const where = [];
  for (const file of [...context.source, ...context.css]) {
    const found = [...file.masked.matchAll(CONTAINER_UTILITY)];
    if (found.length === 0) continue;
    const { line } = positionAt(file.text, found[0].index);
    const names = [...new Set(found.map((match) => match[0].split(':').pop()))];
    where.push(`${file.path}:${line} uses ${names.join(', ')}`);
  }
  if (where.length === 0) return [];

  return [
    {
      where: capped(where),
      what: [
        'tokens.css declares --container-sm ... --container-2xl outside any layer, and',
        "Tailwind sizes these utilities from the same variables. The design system's",
        `values win: max-w-md is ${ours.value}, not ${TAILWIND_CONTAINER.md}. Nothing warns.`,
      ],
      fix: [
        "Write the width you mean. For Tailwind's size, use its value:",
        `  ${Object.entries(TAILWIND_CONTAINER)
          .map(([size, value]) => `max-w-${size} -> max-w-[${value}]`)
          .join(', ')}`,
        "For the design system's page width, say so: max-w-(--container-md).",
      ],
    },
  ];
}

/* ------------------------------------------------------ installed versions */

/**
 * Silent traps fixed in a release. Each row is the first version without the
 * bug, so an install older than it still has it. A fixed bug stays fixed, so
 * this list only grows.
 */
export const FIXED_IN = [
  {
    pkg: REACT_PKG,
    version: '2.3.2',
    issues: [78, 103],
    what: 'A Dialog or CommandPalette opens in the top-left corner under Tailwind Preflight or any CSS reset.',
  },
  {
    pkg: TOKENS_PKG,
    version: '0.11.1',
    issues: [112],
    what: 'A Tailwind text-* utility on a link does nothing. The link keeps its own colour.',
  },
  {
    pkg: TOKENS_PKG,
    version: '0.19.0',
    issues: [251],
    what: 'A Tailwind text-* utility on a .t-* element does nothing. The text stays grey.',
  },
  {
    pkg: REACT_PKG,
    version: '3.9.3',
    issues: [126],
    what: 'Input, Select, Textarea and tab triggers are taller than 44px under Tailwind Preflight.',
  },
];

/** True when `version` is a release before `than`. A prerelease or an unreadable version is never "older". */
export function isOlder(version, than) {
  const parsed = parseVersion(version);
  return Boolean(parsed && parsed.prerelease.length === 0 && compareVersions(version, than) < 0);
}

/** Fixed in our packages; still live in an older install. */
function oldInstall(context) {
  return FIXED_IN.filter((row) => isOlder(context.env.versions[row.pkg], row.version)).map(
    (row) => ({
      issues: row.issues,
      where: [`${row.pkg}@${context.env.versions[row.pkg]} is installed`],
      what: [row.what, `Fixed in ${row.pkg}@${row.version}.`],
      fix: [
        `Upgrade ${row.pkg} to ${row.version} or later. This finds the version and updates package.json:`,
        '',
        `  ${DLX} ds-resync --write --only ${row.pkg}`,
      ],
    }),
  );
}

/* ------------------------------------------------------ stale copies */

/** #257, #270. Artifacts written for other versions than the installed ones. */
function staleArtifacts(context) {
  const drift = checkRecordDrift({
    record: context.record,
    installed: {
      reactVersion: context.env.versions[REACT_PKG],
      tokensVersion: context.env.versions[TOKENS_PKG],
    },
  });
  const packages = drift?.packages.filter((entry) => entry.now) ?? [];
  if (packages.length === 0) return [];

  return [
    {
      where: packages.map(
        (entry) =>
          `${RECORD_PATH}: ${entry.name} written for ${entry.written}, ${entry.now} installed`,
      ),
      what: [
        'The agent skills in .claude/skills/ describe other versions than the ones',
        'installed. An agent reading them uses props and tokens that may not exist.',
      ],
      fix: [`  ${REGENERATE_ARTIFACTS}`],
    },
  ];
}

/** The stylesheets a consumer might copy out of @elirobinson/tokens. They share one header. */
const COPYABLE = ['tokens.css', 'palettes.css', 'mobile.css'];

const normalise = (text) => text.replace(/\r\n/g, '\n');

/** A hand copy of a tokens stylesheet that no longer matches any installed one. */
function tokenCopy(context) {
  if (!context.env.tokens) return [];
  const installed = COPYABLE.map((name) => readFile(join(context.env.tokens, 'src', name)))
    .filter(Boolean)
    .map(normalise);
  /* The header line the installed stylesheets open with, read rather than
     written down, so a reworded header cannot silence this check. */
  const header = installed[0]?.split('\n')[1]?.trim();
  if (!header) return [];

  const copies = context.css.filter((file) => {
    const text = normalise(file.text);
    return text.includes(header) && !installed.includes(text);
  });
  if (copies.length === 0) return [];

  const version = context.env.versions[TOKENS_PKG];
  const entry = context.env.react ? DS_STYLESHEETS[0] : DS_STYLESHEETS[1];
  return [
    {
      where: copies.map(
        (file) =>
          `${file.path} is a copy of a ${TOKENS_PKG} stylesheet that differs from ${version}`,
      ),
      what: [
        'A copied stylesheet keeps the values of the release it was copied from.',
        'Upgrading the package does not change it.',
      ],
      fix: [
        'Delete the copy and import the package from your entry stylesheet:',
        '',
        `  @import '${entry}';`,
      ],
    },
  ];
}

/* ------------------------------------------------------------- roster */

/**
 * Every check `ds check` runs, in report order.
 * `issues` are the consumer reports each one comes from.
 *
 * @type {Trap[]}
 */
export const TRAPS = [
  { id: 'font-override', issues: [34], run: fontOverride },
  { id: 'layered-token-override', issues: [34], run: layeredTokenOverride },
  { id: 'layered-import', issues: [34], run: layeredImport },
  { id: 'container-widths', issues: [250], run: containerWidths },
  {
    id: 'old-install',
    issues: [...new Set(FIXED_IN.flatMap((row) => row.issues))],
    run: oldInstall,
  },
  { id: 'stale-artifacts', issues: [257, 270], run: staleArtifacts },
  { id: 'token-copy', issues: [257], run: tokenCopy },
];
