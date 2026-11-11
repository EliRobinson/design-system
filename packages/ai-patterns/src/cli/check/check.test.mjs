// Every trap has a fixture app that trips it and nothing else, and one clean
// app trips nothing. Each fixture is copied to a temp directory first: inside
// this repo, the package lookup would walk up and find the workspace's real
// node_modules instead of the install the fixture describes.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { findPackageDir, versionOf } from '../../package-lookup.mjs';
import { REACT_PKG, TOKEN_STYLESHEETS, TOKENS_PKG } from '../discovery.mjs';
import { run } from '../run.mjs';
import { declarations } from './scan.mjs';
import { FIXED_IN, isOlder, TRAPS } from './traps.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '__fixtures__');

/** The workspace packages: what `{{react}}` and `{{tokens}}` in a fixture mean. */
const tokensDir = findPackageDir(TOKENS_PKG, [here]);
const current = {
  [REACT_PKG]: versionOf(findPackageDir(REACT_PKG, [here])),
  [TOKENS_PKG]: versionOf(tokensDir),
};

const roots = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

function substitute(text) {
  return text
    .replaceAll('{{react}}', current[REACT_PKG])
    .replaceAll('{{tokens}}', current[TOKENS_PKG]);
}

function walkFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

/**
 * Copies a fixture to a temp dir and installs what its installed.json names.
 * The tokens install carries the real stylesheets, so the checks read the
 * same tokens.css a consumer would. A fixture's `installed/` folder is laid
 * over node_modules last, for a trap that only an older install has.
 */
function materialise(name) {
  const root = mkdtempSync(join(tmpdir(), `ds-check-${name}-`));
  roots.push(root);
  cpSync(join(fixtures, name), root, { recursive: true });
  for (const path of walkFiles(root)) writeFileSync(path, substitute(readFileSync(path, 'utf8')));

  const installed = JSON.parse(readFileSync(join(root, 'installed.json'), 'utf8'));
  for (const [pkg, version] of Object.entries(installed)) {
    const dir = join(root, 'node_modules', ...pkg.split('/'));
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: pkg, version }));
    if (pkg === TOKENS_PKG) {
      for (const sheet of [...TOKEN_STYLESHEETS, 'mobile.css']) {
        cpSync(join(tokensDir, 'src', sheet), join(dir, 'src', sheet));
      }
    }
  }
  const overlay = join(root, 'installed');
  if (existsSync(overlay)) {
    cpSync(overlay, join(root, 'node_modules'), { recursive: true });
    rmSync(overlay, { recursive: true });
  }
  return root;
}

async function check(root, ...flags) {
  return run(['check', ...flags], { cwd: root });
}

/** The trap ids a report names, from its `warn  <id>` lines. */
function trapsIn(text) {
  return [...new Set([...text.matchAll(/^warn {2}(\S+)/gm)].map((match) => match[1]))];
}

describe('ds check', () => {
  it('has exactly one fixture per trap, plus clean', () => {
    const names = readdirSync(fixtures).sort();
    expect(names).toEqual([...TRAPS.map((trap) => trap.id), 'clean'].sort());
  });

  it('finds nothing in the clean app, and says which checks ran', async () => {
    const { text, exitCode } = await check(materialise('clean'), '--strict');
    expect(trapsIn(text)).toEqual([]);
    expect(text).toContain('no known traps found');
    for (const trap of TRAPS) expect(text).toContain(trap.id);
    expect(exitCode).toBe(0);
  });

  for (const trap of TRAPS) {
    describe(trap.id, () => {
      it('flags its fixture and nothing else', async () => {
        const { text } = await check(materialise(trap.id));
        expect(trapsIn(text)).toEqual([trap.id]);
        for (const number of trap.issues) expect(text).toContain(`#${number}`);
        expect(text).toMatch(/Where: /);
        expect(text).toMatch(/Fix:/);
      });

      it('exits 0 by default and 1 with --strict', async () => {
        const root = materialise(trap.id);
        expect((await check(root)).exitCode).toBe(0);
        const strict = await check(root, '--strict');
        expect(strict.exitCode).toBe(1);
        expect(strict.text).toContain('--strict');
      });
    });
  }

  it('reads --dir instead of the working directory', async () => {
    const root = materialise('font-override');
    const { text } = await run(['check', '--dir', root], { cwd: tmpdir() });
    expect(trapsIn(text)).toEqual(['font-override']);
  });

  it('names the variables the app declared in the font fix', async () => {
    const { text } = await check(materialise('font-override'));
    expect(text).toContain('--ds-font-sans-override: var(--font-geist-sans);');
    expect(text).toContain('--ds-font-mono-override: var(--font-geist-mono);');
    expect(text).toContain('src/app.css');
  });

  it('tells the Tailwind size apart from the design system width', async () => {
    const { text } = await check(materialise('container-widths'));
    expect(text).toContain('app/page.tsx:2 uses max-w-md');
    expect(text).toContain('md is 28rem');
  });

  it('says nothing was checked when neither package is installed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ds-check-empty-'));
    roots.push(root);
    const { text, exitCode } = await check(root);
    expect(text).toContain('nothing could be checked');
    expect(text).not.toContain('no known traps');
    expect(exitCode).toBe(0);
    expect((await check(root, '--strict')).exitCode).toBe(1);
  });

  it('fails on a --dir that is not a directory', async () => {
    const { text, exitCode } = await run(['check', '--dir', 'no-such-dir'], { cwd: tmpdir() });
    expect(text).toContain('is not a directory');
    expect(exitCode).toBe(1);
  });

  it('resolves a relative --dir against the working directory', async () => {
    const root = materialise('font-override');
    const { text } = await run(['check', '--dir', '.'], { cwd: root });
    expect(trapsIn(text)).toEqual(['font-override']);
  });

  it('leaves a layered override alone where tokens.css sets nothing', async () => {
    const root = materialise('clean');
    writeFileSync(
      join(root, 'src', 'promo.css'),
      '@layer components { .promo { --accent: red; } .btn--accent:hover { color: red; } }\n',
    );
    expect(trapsIn((await check(root)).text)).toEqual([]);
  });

  it('flags a token set in @theme', async () => {
    const root = materialise('clean');
    writeFileSync(join(root, 'src', 'theme.css'), '@theme inline { --font-sans: serif; }\n');
    const { text } = await check(root);
    expect(trapsIn(text)).toEqual(['layered-token-override']);
    expect(text).toContain('src/theme.css:1 sets --font-sans inside @theme inline');
  });

  it('still flags next/font when the hook is only read, never set', async () => {
    const root = materialise('clean');
    const app = join(root, 'src', 'app.css');
    writeFileSync(
      app,
      readFileSync(app, 'utf8').replace('--ds-font-sans-override:', '--unrelated:') +
        '.x { font-family: var(--ds-font-sans-override); }\n',
    );
    expect(trapsIn((await check(root)).text)).toEqual(['font-override']);
  });

  it('maps a display face to the display hook, not the sans one', async () => {
    const root = materialise('font-override');
    writeFileSync(
      join(root, 'app', 'layout.tsx'),
      [
        "import { Fraunces, Inter } from 'next/font/google';",
        "const display = Fraunces({ variable: '--font-display-serif' });",
        "const body = Inter({ variable: '--font-inter' });",
      ].join('\n'),
    );
    const { text } = await check(root);
    expect(text).toContain('--ds-font-sans-override: var(--font-inter);');
    expect(text).toContain('--ds-font-display-override: var(--font-display-serif);');
  });

  it('does not call an exact copy stale, whatever its line endings', async () => {
    const root = materialise('clean');
    for (const sheet of ['tokens.css', 'palettes.css']) {
      const text = readFileSync(join(tokensDir, 'src', sheet), 'utf8');
      writeFileSync(join(root, 'src', `copy-${sheet}`), text.replace(/\n/g, '\r\n'));
    }
    expect(trapsIn((await check(root)).text)).toEqual([]);
  });

  it('reads the container width from the installed tokens.css', async () => {
    const root = materialise('container-widths');
    const sheet = join(root, 'node_modules', '@elirobinson', 'tokens', 'src', 'tokens.css');
    writeFileSync(
      sheet,
      readFileSync(sheet, 'utf8').replace('--container-md: 768px', '--container-md: 50rem'),
    );
    expect((await check(root)).text).toContain('max-w-md is 50rem, not 28rem');
  });

  it('stays quiet about container widths on the current tokens.css', async () => {
    const root = materialise('container-widths');
    cpSync(
      join(tokensDir, 'src', 'tokens.css'),
      join(root, 'node_modules', '@elirobinson', 'tokens', 'src', 'tokens.css'),
    );
    expect(trapsIn((await check(root)).text)).toEqual([]);
  });
});

describe('FIXED_IN', () => {
  it('names only versions the package has already released', () => {
    for (const row of FIXED_IN) {
      expect(isOlder(current[row.pkg], row.version), `${row.pkg}@${row.version}`).toBe(false);
    }
  });

  it('compares versions numerically', () => {
    expect(isOlder('2.3.1', '2.3.2')).toBe(true);
    expect(isOlder('2.10.0', '2.9.9')).toBe(false);
    expect(isOlder('3.9.3', '3.9.3')).toBe(false);
    expect(isOlder('3.0.0-next.1', '3.9.3')).toBe(false);
    expect(isOlder(undefined, '1.0.0')).toBe(false);
  });
});

describe('declarations', () => {
  it('lists each declaration with the blocks around it, outermost first', () => {
    const css = '@layer base { :root { --accent: red; } } :root { --fg: blue; }';
    expect(declarations(css).map(({ name, blocks }) => [name, blocks])).toEqual([
      ['--accent', ['@layer base', ':root']],
      ['--fg', [':root']],
    ]);
  });

  it('does not read a BEM modifier in a selector as a declaration', () => {
    expect(declarations('@layer components { .btn--accent:hover { color: red; } }')).toEqual([]);
  });
});
