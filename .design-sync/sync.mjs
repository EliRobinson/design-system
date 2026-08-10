// The single supported entry point for a design-sync run.
//
//   node .design-sync/sync.mjs [--remote <file>] [--skip-build] [driver args…]
//
// Why this exists: `resync.mjs` (the converter's driver) chains
// build → diff → validate → capture, but it does NOT run `cfg.buildCmd`. Run
// the driver directly after changing DS source and it converts a stale `dist/`
// with stale generated entries, silently. This wrapper runs the inputs the
// driver won't, then guards the output.
//
// The guards exist because the converter's own gates cannot catch these:
//
//   * Empty roster. With `packages/react/index.d.ts` missing, the converter
//     reports "exported PascalCase symbols: 0" and BOTH package-build.mjs and
//     package-validate.mjs still exit 0 — validate even prints "✓ bundle is
//     complete". A re-sync would publish an empty design system over a good
//     one with every gate green.
//   * Roster drift. A component added to Storybook without re-running
//     gen-entry.mjs is simply absent from the bundle; nothing complains.
//
// Both are caught here by asserting the built component count equals the
// number of Storybook titles minus the ones `cfg.titleMap` excludes.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const cfgPath = join(here, 'config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

const argv = process.argv.slice(2);
const skipBuild = argv.includes('--skip-build');
const passthrough = argv.filter((a) => a !== '--skip-build');

const OUT = './ds-bundle';
const die = (msg) => {
  console.error(`\n[sync] ${msg}\n`);
  process.exit(1);
};
const step = (msg) => console.error(`\n[sync] ${msg}`);

const exec = (cmd, args, label) => {
  const r = spawnSync(cmd, args, { cwd: repoRoot, stdio: 'inherit' });
  if (r.error) die(`${label} could not start: ${r.error.message}`);
  if (r.status !== 0) die(`${label} failed (exit ${r.status ?? `signal ${r.signal}`}).`);
};
// cfg.buildCmd is a shell string ("pnpm build && node …"), so it needs a shell.
const execShell = (cmdline, label) => {
  const r = spawnSync(cmdline, { cwd: repoRoot, stdio: 'inherit', shell: true });
  if (r.error) die(`${label} could not start: ${r.error.message}`);
  if (r.status !== 0) die(`${label} failed (exit ${r.status ?? `signal ${r.signal}`}).`);
};

// ── 0. staged converter ──────────────────────────────────────────────────
if (!existsSync(join(repoRoot, '.ds-sync', 'resync.mjs'))) {
  die(
    'The converter is not staged. Copy it from the design-sync skill first:\n' +
      '  mkdir -p .ds-sync && cp -r "<skill-base-dir>"/{package-build.mjs,package-validate.mjs,resync.mjs,lib,storybook,non-storybook} .ds-sync/\n' +
      '  echo \'{"name":"ds-sync-deps","private":true}\' > .ds-sync/package.json\n' +
      '  (cd .ds-sync && npm i esbuild ts-morph @types/react playwright && npx playwright install chromium)',
  );
}

// ── 1. the inputs the driver never regenerates ───────────────────────────
if (skipBuild) {
  step('--skip-build: reusing the existing dist/ and generated entries.');
} else {
  step(`running cfg.buildCmd: ${cfg.buildCmd}`);
  execShell(cfg.buildCmd, 'buildCmd');
}

step('checking the generated types entry is current');
exec(process.execPath, [join(here, 'gen-entry.mjs'), '--check'], 'gen-entry --check');

// ── 2. reference-storybook staleness ─────────────────────────────────────
// The compiled CSS is scraped out of sb-reference ([CSS_FROM_STORYBOOK]), so a
// reference older than the DS source ships stale styles AND grades previews
// against the old design.
const sbRef = join(repoRoot, cfg.storybookStatic ?? '.design-sync/sb-reference');
const sbIndex = join(sbRef, 'index.json');
if (!existsSync(sbIndex)) {
  die(
    `No reference storybook at ${cfg.storybookStatic} — build it first:\n` +
      `  npx storybook build -c ${cfg.storybookConfigDir} -o "$(git rev-parse --show-toplevel)/${cfg.storybookStatic}"`,
  );
}
const newestUnder = (dir) => {
  let newest = 0;
  if (!existsSync(dir)) return newest;
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else newest = Math.max(newest, statSync(p).mtimeMs);
    }
  })(dir);
  return newest;
};
const refBuilt = statSync(sbIndex).mtimeMs;
const srcTouched = Math.max(
  newestUnder(join(repoRoot, 'packages/react/src')),
  newestUnder(join(repoRoot, 'packages/tokens/src')),
  newestUnder(join(repoRoot, 'apps/storybook/src')),
);
if (srcTouched > refBuilt) {
  console.error(
    `\n[sync] WARNING: ${cfg.storybookStatic} is older than the DS source.\n` +
      '[sync] Component CSS is scraped from it and previews are graded against it,\n' +
      '[sync] so a stale reference ships stale styles and grades the OLD design.\n' +
      `[sync] Rebuild:  npx storybook build -c ${cfg.storybookConfigDir} -o "$(git rev-parse --show-toplevel)/${cfg.storybookStatic}"\n`,
  );
}

// ── 3. the driver ────────────────────────────────────────────────────────
step('running the converter driver');
exec(
  process.execPath,
  [
    join(repoRoot, '.ds-sync/resync.mjs'),
    '--config',
    cfgPath,
    '--node-modules',
    join(repoRoot, 'node_modules'),
    '--out',
    OUT,
    ...passthrough,
  ],
  'resync.mjs',
);

// ── 4. roster guard — the check no converter gate performs ───────────────
const metaPath = join(repoRoot, OUT, '.ds-build-meta.json');
if (!existsSync(metaPath))
  die(`${OUT}/.ds-build-meta.json is missing — the build did not complete.`);
const built = JSON.parse(readFileSync(metaPath, 'utf8')).componentCount ?? 0;

const titles = [
  ...new Set(Object.values(JSON.parse(readFileSync(sbIndex, 'utf8')).entries).map((e) => e.title)),
];
const excluded = Object.entries(cfg.titleMap ?? {})
  .filter(([, v]) => v === null)
  .map(([k]) => k);
const expected = titles.length - excluded.length;

if (built === 0) {
  die(
    'ROSTER IS EMPTY — refusing to continue.\n' +
      'The bundle has 0 components, which build+validate both report as success.\n' +
      'Usual cause: packages/react/index.d.ts is missing or does not resolve.\n' +
      'Fix:  node .design-sync/gen-entry.mjs',
  );
}
if (built !== expected) {
  die(
    `ROSTER MISMATCH — built ${built} components, expected ${expected}.\n` +
      `(${titles.length} Storybook titles minus ${excluded.length} excluded via cfg.titleMap` +
      `${excluded.length ? `: ${excluded.join(', ')}` : ''})\n` +
      'A component in Storybook that is missing from the bundle is usually a stale\n' +
      'generated entry — run `node .design-sync/gen-entry.mjs` — or a title that needs\n' +
      'a cfg.titleMap entry. If the difference is intentional, update cfg.titleMap.',
  );
}

console.error(
  `\n[sync] OK — ${built}/${expected} components built and verified. Verdict: ${OUT}/.resync-verdict.json\n`,
);
