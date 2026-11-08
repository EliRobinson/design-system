// One check per trap that reached this repo as a consumer issue with no error
// behind it: the app looked wrong, and nothing said why. Each check reads the
// consumer's files and the INSTALLED packages, never a bundled copy, so it
// describes the versions the app actually runs.
//
// A check returns findings, never throws, and stays quiet when it cannot tell.
// A warning a consumer learns to ignore is worse than no warning.
//
// Adding a trap: add an entry to TRAPS, and a fixture under __fixtures__/ that
// trips it and nothing else. check.test.mjs fails until both exist.

import { join } from 'node:path';

import { DLX } from '../../artifacts/llms.mjs';
import { checkRecordDrift } from '../../resync/artifacts.mjs';
import { positionAt } from '../../resync/scan.mjs';
import { cssVariables, REACT_PKG, readFile, TOKENS_PKG } from '../discovery.mjs';
import { cssImports, DS_STYLESHEETS, enclosingBlocks } from './scan.mjs';

/** Where-lists longer than this are cut, with a count of the rest. */
const MAX_WHERE = 8;

function capped(lines) {
  if (lines.length <= MAX_WHERE) return lines;
  return [...lines.slice(0, MAX_WHERE), `…and ${lines.length - MAX_WHERE} more`];
}

/** The consumer stylesheet that imports the design system: where a fix goes. */
function entryStylesheet(context) {
  return context.css.find((file) =>
    cssImports(file).some((entry) => DS_STYLESHEETS.includes(entry.specifier)),
  )?.path;
}

/* ---------------------------------------------------------------- fonts */

const NEXT_FONT = /from\s+['"](next\/font\/(?:google|local)|geist\/font(?:\/[\w-]+)?)['"]/;

/** #34. `next/font` loads the family under a hashed name, so tokens.css's literal 'Geist' matches nothing. */
function fontOverride(context) {
  if (!context.usesDesignSystem) return [];
  const fontFiles = context.source.filter((file) => NEXT_FONT.test(file.masked));
  if (fontFiles.length === 0) return [];

  const setsOverride = [...context.css, ...context.source].some((file) =>
    file.masked.includes('--ds-font-sans-override'),
  );
  if (setsOverride) return [];

  const variables = fontFiles.flatMap((file) =>
    [...file.masked.matchAll(/variable:\s*['"](--[\w-]+)['"]/g)].map((match) => match[1]),
  );
  const mono = variables.find((name) => name.includes('mono'));
  const sans = variables.find((name) => name !== mono) ?? '--font-geist-sans';

  return [
    {
      where: fontFiles.map(
        (file) =>
          `${file.path} loads a font with next/font, and no file sets --ds-font-sans-override`,
      ),
      what: [
        'next/font gives the font a generated name. tokens.css asks for it by its real',
        'name, finds nothing, and the page renders in the system font. Nothing errors.',
      ],
      fix: [
        `Add this to ${entryStylesheet(context) ?? 'your entry stylesheet'}, outside any @layer:`,
        '',
        '  :root {',
        `    --ds-font-sans-override: var(${sans});`,
        ...(mono ? [`    --ds-font-mono-override: var(${mono});`] : []),
        '  }',
        '',
        "Put the font's `variable` class on <html>, so the variable exists at :root.",
      ],
    },
  ];
}

/* ------------------------------------------------------ layer and order */

/** #34's second cause. A token re-declared inside a cascade layer loses to the unlayered tokens.css. */
function layeredTokenOverride(context) {
  const sheets = context.env.tokenStylesheets;
  if (!sheets) return [];
  const tokens = new Set(cssVariables(sheets).map(({ name }) => name));

  const where = [];
  for (const file of context.css) {
    for (const match of file.masked.matchAll(/(--[\w-]+)\s*:/g)) {
      if (!tokens.has(match[1])) continue;
      const layer = enclosingBlocks(file.masked, match.index).find((prelude) =>
        /^@(?:layer|theme)\b/.test(prelude),
      );
      if (!layer) continue;
      const { line } = positionAt(file.text, match.index);
      where.push(`${file.path}:${line} sets ${match[1]} inside ${layer.split(/\s+/)[0]}`);
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
        'Move each one into a plain `:root { … }` rule, outside any @layer or @theme,',
        'after the design system import. For a font family, set',
        '--ds-font-sans-override (or -mono-, -display-) instead of --font-sans.',
      ],
    },
  ];
}

/** The design system imported into a cascade layer, which puts Preflight or utilities on the wrong side of it. */
function layeredImport(context) {
  const layered = context.css.flatMap((file) =>
    cssImports(file)
      .filter((entry) => DS_STYLESHEETS.includes(entry.specifier) && /\blayer\b/.test(entry.tail))
      .map((entry) => ({ file, entry })),
  );
  if (layered.length === 0) return [];
  const where = layered.map(
    ({ file, entry }) => `${file.path}:${entry.line} imports ${entry.specifier} ${entry.tail}`,
  );

  return [
    {
      where,
      what: [
        'The design system is built to sit outside every cascade layer. Inside one,',
        "layer order wins over selectors: a layer before Tailwind's base lets",
        "Preflight reset every component's margin, padding and border, and a layer",
        'after utilities makes Tailwind utilities stop working on components.',
      ],
      fix: ['Remove `layer(…)` from the import:', '', `  @import '${layered[0].entry.specifier}';`],
    },
  ];
}

/* ------------------------------------------------------- Tailwind sizes */

/** Tailwind v4's own values for the five names tokens.css re-declares. */
const TAILWIND_CONTAINER = { sm: '24rem', md: '28rem', lg: '32rem', xl: '36rem', '2xl': '42rem' };

const CONTAINER_UTILITY =
  /(?<![\w-])(?:[\w-]+:)*(max-w|min-w|w|basis|inline|columns)-(sm|md|lg|xl|2xl)(?![\w-])/g;

/** #250. tokens.css's unlayered `--container-*` replaces Tailwind's, so `max-w-md` is 768px, not 448px. */
function containerWidths(context) {
  const declares = context.env.tokenStylesheets?.some((sheet) => /--container-md\s*:/.test(sheet));
  if (!declares || !context.usesDesignSystem || !context.usesTailwind) return [];

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
        'tokens.css declares --container-sm … --container-2xl outside any layer, and',
        "Tailwind sizes these utilities from the same variables. The design system's",
        'values win: max-w-md is 768px, not 448px. Nothing warns.',
      ],
      fix: [
        "Write the width you mean. For Tailwind's size, use its value:",
        `  ${Object.entries(TAILWIND_CONTAINER)
          .map(([size, value]) => `max-w-${size} → max-w-[${value}]`)
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

/** `[major, minor, patch]`, or null for anything that is not a plain release. */
function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  return match ? match.slice(1).map(Number) : null;
}

export function isOlder(version, than) {
  const [a, b] = [parseVersion(version), parseVersion(than)];
  if (!a || !b) return false;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index];
  }
  return false;
}

/** #78, #103, #112, #251, #126. Fixed in our packages; still live in an older install. */
function oldInstall(context) {
  return FIXED_IN.filter((row) => isOlder(context.env.versions[row.pkg], row.version)).map(
    (row) => ({
      issues: row.issues,
      where: [`${row.pkg}@${context.env.versions[row.pkg]} is installed`],
      what: [row.what, `Fixed in ${row.pkg}@${row.version}.`],
      fix: [`  pnpm add ${row.pkg}@latest`],
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
          `.claude/ds-artifacts.json: ${entry.name} written for ${entry.written}, ${entry.now} installed`,
      ),
      what: [
        'The agent skills in .claude/skills/ describe other versions than the ones',
        'installed. An agent reading them uses props and tokens that may not exist.',
      ],
      fix: [`  ${DLX} ds-resync artifacts --write`],
    },
  ];
}

const TOKENS_HEADER = 'Miltinson Design System — Design Tokens';

/** A hand copy of tokens.css in the repo that no longer matches the installed one. */
function tokenCopy(context) {
  if (!context.env.tokens) return [];
  const installed = readFile(join(context.env.tokens, 'src', 'tokens.css'));
  if (!installed) return [];

  const copies = context.css.filter(
    (file) => file.text.includes(TOKENS_HEADER) && file.text !== installed,
  );
  if (copies.length === 0) return [];

  const version = context.env.versions[TOKENS_PKG];
  return [
    {
      where: copies.map(
        (file) => `${file.path} is a copy of tokens.css that differs from ${TOKENS_PKG}@${version}`,
      ),
      what: [
        'A copied stylesheet keeps the values of the release it was copied from.',
        'Upgrading the package does not change it.',
      ],
      fix: [
        'Delete the copy and import the package from your entry stylesheet:',
        '',
        `  @import '${DS_STYLESHEETS[0]}';`,
      ],
    },
  ];
}

/* ------------------------------------------------------------- roster */

/**
 * Every check `ds check` runs, in report order.
 * `issues` are the consumer reports each one comes from.
 */
export const TRAPS = [
  { id: 'font-override', issues: [34], run: fontOverride },
  { id: 'layered-token-override', issues: [34], run: layeredTokenOverride },
  { id: 'layered-import', issues: [34], run: layeredImport },
  { id: 'container-widths', issues: [250], run: containerWidths },
  { id: 'old-install', issues: [78, 103, 112, 251, 126], run: oldInstall },
  { id: 'stale-artifacts', issues: [257, 270], run: staleArtifacts },
  { id: 'token-copy', issues: [257], run: tokenCopy },
];
