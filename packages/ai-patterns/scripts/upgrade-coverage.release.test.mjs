/* The upgrade.md coverage rules (upgrade-coverage.mjs) from a PR to its release (#334),
 * run in a scratch git repo with the real `changeset version`, so the hash the stamp
 * writes is the one Changesets writes. Plus unit tests of each rule. The suite that runs
 * the rules on this repo's own upgrade.md is src/migrate/upgrade-coverage.test.mjs. */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  coverage,
  gitResolver,
  migrationCoverage,
  needsSection,
  readCoverageInputs,
  stampPending,
  UPGRADE_MD,
} from './upgrade-coverage.mjs';

const require = createRequire(import.meta.url);
const stampScript = join(dirname(fileURLToPath(import.meta.url)), 'stamp-upgrade.mjs');
const changesetBin = join(dirname(require.resolve('@changesets/cli/package.json')), 'bin.js');
const changelog = join(dirname(require.resolve('@changesets/cli/package.json')), 'changelog');

const BREAKING = `---
'@elirobinson/foo': minor
---

**Breaking:** \`Foo\` is now \`Bar\`.
`;

const SECTION = (version, changeset) => `
## foo-0.4-bar

- Package: \`@elirobinson/foo\`
- Version: \`${version}\`
- Changeset: \`${changeset}\`
- Find: \`Foo\`

\`Foo\` is now \`Bar\`.
`;

let root;
const write = (path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const git = (...args) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
const commit = (message) => {
  git('add', '-A');
  git('commit', '-q', '-m', message);
};
const check = async () => coverage(await readCoverageInputs(root));
const CLEAN = { missing: [], invented: [], nearMarker: [] };

describe('from a PR to its release', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'upgrade-coverage-'));
    write(
      'package.json',
      JSON.stringify({ name: 'fixture', private: true, workspaces: ['packages/*'] }),
    );
    write(
      '.changeset/config.json',
      JSON.stringify({ changelog, commit: false, baseBranch: 'main', access: 'restricted' }),
    );
    write(
      'packages/foo/package.json',
      JSON.stringify({ name: '@elirobinson/foo', version: '0.3.0' }),
    );
    write(
      'packages/foo/CHANGELOG.md',
      '# @elirobinson/foo\n\n## 0.3.0\n\n### Minor Changes\n\n- 1234567: First.\n',
    );
    write(UPGRADE_MD, '# Upgrade\n');
    git('init', '-q', '-b', 'main');
    commit('init');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  describe('a PR that adds a breaking changeset', () => {
    it('fails until upgrade.md has a section for it', async () => {
      write('.changeset/brave-fox.md', BREAKING);
      expect((await check()).missing).toEqual([
        '@elirobinson/foo brave-fox (pending): **Breaking:** `Foo` is now `Bar`.',
      ]);
    });

    it('passes once a pending section names the changeset', async () => {
      write('.changeset/brave-fox.md', BREAKING);
      write(UPGRADE_MD, `# Upgrade\n${SECTION('pending', 'brave-fox')}`);
      expect(await check()).toEqual(CLEAN);
    });

    it('fails a pending section whose changeset does not exist', async () => {
      write(UPGRADE_MD, `# Upgrade\n${SECTION('pending', 'brave-fox')}`);
      expect((await check()).invented).toEqual([
        'foo-0.4-bar: @elirobinson/foo@pending has no changeset brave-fox',
      ]);
    });

    it('passes a 0.x minor that says "breaking change" without the marker', async () => {
      write(
        '.changeset/calm-owl.md',
        "---\n'@elirobinson/foo': minor\n---\n\nAdds a check that finds a breaking change.\n",
      );
      expect(await check()).toEqual(CLEAN);
    });

    it('fails a 0.x minor that starts like the marker but is not it', async () => {
      write(
        '.changeset/calm-owl.md',
        "---\n'@elirobinson/foo': minor\n---\n\nBreaking: renames Foo.\n",
      );
      expect((await check()).nearMarker).toEqual([
        '@elirobinson/foo calm-owl (pending): Breaking: renames Foo.',
      ]);
    });

    it('reads a changeset the way Changesets does, YAML comment and all', async () => {
      write(
        '.changeset/brave-fox.md',
        "---\n'@elirobinson/foo': major # renames Foo\n---\n\nRenames Foo.\n",
      );
      expect((await check()).missing).toEqual([
        '@elirobinson/foo brave-fox (pending): Renames Foo.',
      ]);
    });
  });

  describe('the release of a covered change', () => {
    beforeEach(() => {
      write('.changeset/brave-fox.md', BREAKING);
      write(UPGRADE_MD, `# Upgrade\n${SECTION('pending', 'brave-fox')}`);
      commit('feat: Foo is now Bar');
      execFileSync('node', [changesetBin, 'version'], { cwd: root, stdio: 'pipe' });
    });

    it('would turn main red without the stamp', async () => {
      const result = await check();
      expect(result.missing).toHaveLength(1);
      expect(result.invented).toHaveLength(1);
    });

    it('keeps main green once the stamp fills in the version and hash', async () => {
      execFileSync('node', [stampScript, root], { stdio: 'pipe' });
      const hash = git(
        'log',
        '--diff-filter=A',
        '--format=%h',
        '--abbrev=7',
        '--',
        '.changeset/brave-fox.md',
      );
      expect(readFileSync(join(root, UPGRADE_MD), 'utf8')).toBe(
        `# Upgrade\n${SECTION('0.4.0', hash)}`,
      );
      expect(await check()).toEqual(CLEAN);
    });

    it('fails the release when a section cannot be stamped', () => {
      write(
        UPGRADE_MD,
        `# Upgrade\n${SECTION('pending', 'brave-fox')}`.replace('`pending`', '`pending` (soon)'),
      );
      expect(() => execFileSync('node', [stampScript, root], { stdio: 'pipe' })).toThrow(
        /does not match the release/,
      );
    });

    it('fails the release when no commit added a pending changeset', () => {
      const markdown = `# Upgrade\n${SECTION('pending', 'ghost')}`;
      expect(() => stampPending(markdown, gitResolver(root))).toThrow(/no commit added/);
    });
  });
});

describe('needsSection', () => {
  const change = (bump, previous, text) => needsSection({ bump, previous, text });

  it('counts every major', () => {
    expect(change('major', '2.1.0', 'Renames a prop.')).toBe(true);
    expect(change('major', '0.9.0', 'Renames a prop.')).toBe(true);
  });

  it('counts a 0.x minor only when it starts with the marker', () => {
    expect(change('minor', '0.3.0', '**Breaking:** Renames a prop.')).toBe(true);
    expect(change('minor', '0.3.0', 'Adds a test for any breaking change.')).toBe(false);
    expect(change('minor', '0.3.0', 'Breaking: no bold, so not the marker.')).toBe(false);
    expect(change('minor', '0.3.0', 'Renames a prop. **Breaking:** later in the text.')).toBe(
      false,
    );
  });

  it('does not count the marker on a 1.x minor or on a patch', () => {
    expect(change('minor', '1.3.0', '**Breaking:** Renames a prop.')).toBe(false);
    expect(change('patch', '0.3.0', '**Breaking:** Renames a prop.')).toBe(false);
  });
});

describe('stampPending', () => {
  it('leaves a section alone while its changeset is still pending', () => {
    const markdown = `# Upgrade\n${SECTION('pending', 'brave-fox')}`;
    expect(stampPending(markdown, () => null)).toBe(markdown);
  });

  it('leaves released sections alone', () => {
    const markdown = `# Upgrade\n${SECTION('0.4.0', 'abcdef1')}`;
    expect(stampPending(markdown, () => ({ version: '9.9.9', hash: '0000000' }))).toBe(markdown);
  });

  it('stamps a section with CRLF line endings', () => {
    const crlf = (text) => text.replaceAll('\n', '\r\n');
    const markdown = crlf(`# Upgrade\n${SECTION('pending', 'brave-fox')}`);
    expect(stampPending(markdown, () => ({ version: '0.4.0', hash: 'abcdef1' }))).toBe(
      crlf(`# Upgrade\n${SECTION('0.4.0', 'abcdef1')}`),
    );
  });
});

describe('migrationCoverage', () => {
  const silent = { id: 'silent', report: 'none' };
  const loud = { id: 'loud', report: 'occurrence' };

  it('lets a silent migration go without a section', () => {
    expect(migrationCoverage([], [silent]).missing).toEqual([]);
  });

  it('still allows a section for a silent migration', () => {
    expect(migrationCoverage([{ migration: 'silent' }], [silent])).toEqual({
      missing: [],
      unknown: [],
      duplicated: [],
    });
  });

  it('fails a migration that reports something and has no section', () => {
    expect(migrationCoverage([], [silent, loud]).missing).toEqual(['loud']);
  });

  it('fails a section for a migration that does not exist, or one named twice', () => {
    const result = migrationCoverage(
      [{ migration: 'loud' }, { migration: 'loud' }, { migration: 'gone' }],
      [loud],
    );
    expect(result.unknown).toEqual(['gone']);
    expect(result.duplicated).toEqual(['loud']);
  });
});
