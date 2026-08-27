// The CLI's job is to describe whatever is installed, whatever shape it takes.
// These fixtures build node_modules trees by hand so each layout the CLI has to
// survive — tiered with a manifest, flat without one, nothing installed at all —
// is exercised directly rather than assumed.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COMBINATIONS,
  DEFAULT_PLATFORM,
  DIALS,
  PALETTES,
  PLATFORMS,
  dialAttributeString,
  platformOverrides,
  tokenDials,
} from '@elirobinson/tokens/dials';
import {
  readPlatformStylesheets,
  readTokenStylesheets,
} from '@elirobinson/tokens/token-stylesheets';
import { afterEach, describe, expect, it } from 'vitest';

import { findPackageDir, loadInventory } from './discovery.mjs';
import { mergeBlock } from './init.mjs';
import { run } from './run.mjs';

const patternsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const roots = [];

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

function write(root, path, contents) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2));
}

/** A consumer project root with the given packages under node_modules. */
function consumer(packages) {
  const root = mkdtempSync(join(tmpdir(), 'ds-cli-'));
  roots.push(root);
  write(root, 'package.json', { name: 'consumer', private: true });

  for (const [name, files] of Object.entries(packages)) {
    for (const [path, contents] of Object.entries(files)) {
      write(root, join('node_modules', ...name.split('/'), path), contents);
    }
  }

  return root;
}

const TOKENS_CSS = `:root {
  --bg: #ffffff;
  --accent: var(--signal-500);
}
.t-h1 { font-size: 30px; }
`;

const BUTTON_MANIFEST = {
  manifestVersion: 1,
  package: '@elirobinson/react',
  version: '1.1.0',
  tiers: ['atoms'],
  components: [
    {
      name: 'Button',
      tier: 'atoms',
      subpath: 'atoms/Button',
      importSpecifier: '@elirobinson/react/components/atoms/Button',
      exports: ['Button'],
      types: ['ButtonVariant', 'ButtonProps'],
      propsType: 'ButtonProps',
      variants: [{ prop: 'variant', type: 'ButtonVariant', values: ['primary', 'ghost'] }],
    },
  ],
  hooks: [
    {
      name: 'useEscapeKey',
      subpath: 'useEscapeKey',
      importSpecifier: '@elirobinson/react/hooks/useEscapeKey',
      exports: ['useEscapeKey'],
      types: [],
    },
  ],
};

/** The 1.x shape: tiered components plus a manifest. */
function tieredConsumer() {
  return consumer({
    '@elirobinson/react': {
      'package.json': { name: '@elirobinson/react', version: '1.1.0' },
      'dist/manifest.json': BUTTON_MANIFEST,
      'dist/components/atoms/Button.d.ts': 'export declare const Button: unknown;\n',
      'src/components/atoms/Button.css': '.ds-button { color: var(--fg); }\n',
    },
    '@elirobinson/tokens': {
      'package.json': { name: '@elirobinson/tokens', version: '0.2.0' },
      'src/tokens.css': TOKENS_CSS,
    },
    '@elirobinson/ai-patterns': {
      'package.json': { name: '@elirobinson/ai-patterns', version: '0.4.0' },
      'src/patterns.md': '# AI Product Patterns\n',
      'src/contracts.json': {
        uiContracts: {
          minimumTouchTarget: '44x44',
          verifiedBy: { minimumTouchTarget: 'checkTouchTargets()' },
        },
        componentConstraints: {
          'no-barrel-imports': {
            summary: 'Subpaths only.',
            check: 'Every import.',
            verifiedBy: 'rule',
          },
        },
      },
      'src/prompts/audit-page.md': '# Audit\n',
    },
  });
}

/** The 0.x shape: flat components, no manifest. */
function flatConsumer() {
  return consumer({
    '@elirobinson/react': {
      'package.json': { name: '@elirobinson/react', version: '0.4.0' },
      'dist/components/Button.d.ts':
        "export type ButtonVariant = 'primary' | 'ghost';\nexport declare const Button: unknown;\n",
      'dist/components/Card.d.ts': 'export declare function Card(): unknown;\n',
    },
    '@elirobinson/tokens': {
      'package.json': { name: '@elirobinson/tokens', version: '0.1.0' },
      'src/tokens.css': TOKENS_CSS,
    },
  });
}

/* The real @elirobinson/tokens, resolved through its exports map the way a
   consumer resolves it, and symlinked into a fixture's node_modules the way a
   package manager installs it. The dial commands read the installed package's
   own modules, so the only fixture that can exercise them is the real one —
   and using it is what makes these tests widen with the roster: a third
   palette appears here without an edit, and the assertions below fail if the
   CLI does not pick it up. */
const TOKENS_DIR = dirname(
  dirname(createRequire(import.meta.url).resolve('@elirobinson/tokens/tokens.css')),
);
const stylesheets = readTokenStylesheets(join(TOKENS_DIR, 'src'));
const platformCss = readPlatformStylesheets(join(TOKENS_DIR, 'src'));

function dialConsumer() {
  const root = consumer({});
  const scope = join(root, 'node_modules', '@elirobinson');
  mkdirSync(scope, { recursive: true });
  symlinkSync(TOKENS_DIR, join(scope, 'tokens'), 'dir');
  return root;
}

/** The indented rows `ds tokens` printed underneath one token's own line. */
function rowsUnder(text, name) {
  const lines = text.split('\n');
  const start = lines.indexOf(`  ${name}`);
  const rows = [];
  for (let index = start + 1; index < lines.length && lines[index].startsWith('    '); index += 1) {
    rows.push(lines[index]);
  }
  return rows;
}

const at = (root) => ({ origins: [root], cwd: root, selfDir: patternsRoot });

describe('package resolution', () => {
  it('finds a package in node_modules above the search origin', () => {
    const root = tieredConsumer();
    const nested = join(root, 'src', 'app');
    mkdirSync(nested, { recursive: true });

    expect(findPackageDir('@elirobinson/react', [nested])).toBe(
      join(root, 'node_modules', '@elirobinson', 'react'),
    );
  });

  it('returns null rather than throwing when nothing is installed', () => {
    expect(findPackageDir('@elirobinson/react', [consumer({})])).toBeNull();
  });

  // `pnpm --package=@elirobinson/ai-patterns dlx elirobinson-ds` runs the
  // binary from a throwaway store, so this package is absent from the project
  // it is describing. Its own data must still be readable. (The package must be
  // named explicitly: it ships two bins, so the bare `pnpm dlx <pkg> <bin>`
  // form cannot resolve one — see `DLX` in `../artifacts/llms.mjs`.)
  describe('run from outside the project (pnpm dlx)', () => {
    const project = () =>
      consumer({
        '@elirobinson/react': {
          'package.json': { name: '@elirobinson/react', version: '1.1.0' },
          'dist/manifest.json': BUTTON_MANIFEST,
        },
        '@elirobinson/tokens': {
          'package.json': { name: '@elirobinson/tokens', version: '0.2.0' },
          'src/tokens.css': TOKENS_CSS,
        },
      });

    it('still describes the project it is pointed at', async () => {
      const { text } = await run([], at(project()));

      expect(text).toContain('COMPONENTS (1)');
      expect(text).toContain('@elirobinson/react@1.1.0');
    });

    it('falls back to its own package for contracts, patterns and prompts', async () => {
      const env = at(project());

      expect(await run(['contracts'], env)).toMatchObject({ exitCode: 0 });
      expect((await run(['contracts'], env)).text).toContain('no-barrel-imports');
      expect((await run(['patterns'], env)).text).toContain('AI Product Patterns');
      expect((await run(['prompts'], env)).text).toContain('adopt-system');
    });

    it('does not claim to be uninstalled when it is the thing running', async () => {
      expect((await run([], at(project()))).text).not.toContain(
        '@elirobinson/ai-patterns (not installed)',
      );
    });

    it('still reports a genuinely missing package', async () => {
      const { text } = await run([], {
        origins: [consumer({})],
        cwd: '/nowhere',
        selfDir: patternsRoot,
      });

      expect(text).toContain('@elirobinson/react (not installed)');
    });
  });
});

describe('inventory source', () => {
  it('prefers the shipped manifest', () => {
    const dir = join(tieredConsumer(), 'node_modules', '@elirobinson', 'react');
    expect(loadInventory(dir)).toMatchObject({ source: 'manifest', version: '1.1.0' });
  });

  it('falls back to parsing declarations when there is no manifest', () => {
    const dir = join(flatConsumer(), 'node_modules', '@elirobinson', 'react');
    const inventory = loadInventory(dir);

    expect(inventory.source).toBe('declarations');
    expect(inventory.components.map((entry) => entry.name)).toEqual(['Button', 'Card']);
  });
});

describe('ds list', () => {
  it('reports installed versions, components, hooks, classes and tokens', async () => {
    const { text, exitCode } = await run([], at(tieredConsumer()));

    expect(exitCode).toBe(0);
    expect(text).toContain('@elirobinson/react@1.1.0');
    expect(text).toContain('COMPONENTS (1)');
    expect(text).toContain('variant: primary|ghost');
    expect(text).toContain('useEscapeKey');
    expect(text).toContain('t-h1');
    expect(text).toContain('TOKENS  2 custom properties');
  });

  it('groups a tiered layout by tier', async () => {
    expect((await run([], at(tieredConsumer()))).text).toContain('atoms/');
  });

  it('describes a flat layout without inventing a tier, and says the source', async () => {
    const { text } = await run([], at(flatConsumer()));

    expect(text).toContain('COMPONENTS (2)');
    expect(text).not.toContain('atoms/');
    expect(text).toContain('recovered from emitted declarations');
  });

  it('names what to install when packages are missing, and still exits 0', async () => {
    const { text, exitCode } = await run([], at(consumer({})));

    expect(exitCode).toBe(0);
    expect(text).toContain('@elirobinson/react (not installed)');
    expect(text).toContain('pnpm add @elirobinson/react@latest @elirobinson/tokens@latest');
  });
});

describe('ds props', () => {
  it('accepts a bare name and prints the exact import specifier', async () => {
    const { text, exitCode } = await run(['props', 'Button'], at(tieredConsumer()));

    expect(exitCode).toBe(0);
    expect(text).toContain("import { Button } from '@elirobinson/react/components/atoms/Button';");
    expect(text).toContain('variant (ButtonVariant): "primary" | "ghost"');
  });

  it('accepts the full subpath', async () => {
    const { text } = await run(['props', 'atoms/Button'], at(tieredConsumer()));
    expect(text).toContain("'@elirobinson/react/components/atoms/Button'");
  });

  it('treats a capitalised bare argument as a props lookup', async () => {
    expect((await run(['Button'], at(tieredConsumer()))).text).toContain(
      "'@elirobinson/react/components/atoms/Button'",
    );
  });

  it('prints the specifier the installed layout actually uses', async () => {
    expect((await run(['props', 'Button'], at(flatConsumer()))).text).toContain(
      "'@elirobinson/react/components/Button'",
    );
  });

  it('lists what is available when the name is wrong', async () => {
    const { text, exitCode } = await run(['props', 'Nope'], at(tieredConsumer()));

    expect(exitCode).toBe(1);
    expect(text).toContain('No component named "Nope"');
    expect(text).toContain('atoms/Button');
  });
});

describe('ds tokens / classes', () => {
  it('prints every token with its value', async () => {
    const { text } = await run(['tokens'], at(tieredConsumer()));
    expect(text).toContain('--accent');
    expect(text).toContain('var(--signal-500)');
  });

  it('filters by name or value', async () => {
    expect((await run(['tokens', 'accent'], at(tieredConsumer()))).text).not.toContain('--bg ');
    expect((await run(['tokens', 'signal'], at(tieredConsumer()))).text).toContain('--accent');
  });

  it('exits 1 when a filter matches nothing', async () => {
    expect((await run(['tokens', 'nonesuch'], at(tieredConsumer()))).exitCode).toBe(1);
  });

  it('lists classes from both the tokens and component stylesheets', async () => {
    const { text } = await run(['classes'], at(tieredConsumer()));
    expect(text).toContain('t-h1');
    expect(text).toContain('ds-button');
  });
});

/* The dials, and the half of `ds tokens` that reports them.
 *
 * Every assertion below is written against the roster @elirobinson/tokens
 * exports — never against a list of palettes, themes or combinations spelled
 * out here. That is the point: add a third palette upstream and these tests
 * start demanding it of the CLI, and fail if the CLI has hard-coded anything.
 */
describe('ds dials', () => {
  it('names every dial, its attribute, and every value it can take', async () => {
    const { text, exitCode } = await run(['dials'], at(dialConsumer()));

    expect(exitCode).toBe(0);
    for (const dial of DIALS) {
      expect(text, dial.name).toContain(dial.name);
      expect(text, dial.attribute).toContain(dial.attribute);
      expect(text, dial.default).toContain(`${dial.default} (default)`);
      for (const value of dial.values) expect(text, value).toContain(value);
    }
    /* Implied by the loop while `palette` is one of the dials, and stated
       anyway: a palette missing from this output is the exact regression. */
    for (const palette of PALETTES) expect(text, palette).toContain(palette);
  });

  it('lists every combination with the attributes that select it', async () => {
    const { text } = await run(['dials'], at(dialConsumer()));

    expect(text).toContain(`COMBINATIONS (${COMBINATIONS.length})`);
    for (const combination of COMBINATIONS) {
      expect(text, combination.id).toContain(combination.id);

      // The default combination is selected by no attribute at all, so there
      // is nothing to look for — that it is named "default" is asserted below.
      const attributes = dialAttributeString(combination);
      if (attributes) expect(text, attributes).toContain(attributes);
    }
    expect(text).toMatch(/no attributes.*default/);
  });

  it('reports what the platform layer re-points, which no other command shows', async () => {
    const { text } = await run(['dials'], at(dialConsumer()));
    const overrides = platformOverrides(platformCss);

    expect(overrides.length).toBeGreaterThan(0);
    for (const { name, value } of overrides) {
      const row = text.split('\n').find((line) => line.trimStart().startsWith(`${name} `));
      expect(row, name).toBeDefined();
      expect(row, name).toContain(`-> ${value}`);
    }
  });

  it('keeps the platform out of the combination ids', async () => {
    /* The vocabulary rule, enforced. A combination is `<palette>/<theme>` and
       nothing else: the platform changes no colour, so folding it in would
       print twice the combinations with half of them duplicates. */
    const { text } = await run(['dials'], at(dialConsumer()));

    for (const platform of PLATFORMS.filter((one) => one !== DEFAULT_PLATFORM)) {
      for (const { id } of COMBINATIONS) {
        expect(text, `${id}/${platform}`).not.toContain(`${id}/${platform}`);
      }
    }
  });

  it('says what to upgrade when the installed tokens has no roster', async () => {
    const { text, exitCode } = await run(['dials'], at(tieredConsumer()));

    expect(exitCode).toBe(1);
    expect(text).toContain('predates the dial roster');
    expect(text).toContain('pnpm add @elirobinson/tokens@latest');
  });

  it('names what to install when tokens is absent entirely', async () => {
    const { text, exitCode } = await run(['dials'], at(consumer({})));

    expect(exitCode).toBe(1);
    expect(text).toContain('Not installed: @elirobinson/tokens');
  });
});

describe('ds tokens across the combinations', () => {
  const entries = tokenDials(stylesheets, { platformCss });

  it('prints one labelled row per combination for a token that varies', async () => {
    const varying = entries.find((entry) => entry.varies);
    const { text } = await run(['tokens', varying.name], at(dialConsumer()));
    const rows = rowsUnder(text, varying.name);

    expect(rows).toHaveLength(COMBINATIONS.length);
    COMBINATIONS.forEach((combination, index) => {
      expect(rows[index], combination.id).toContain(combination.id);
      expect(rows[index], combination.id).toContain(varying.values[index].value);
    });
  });

  it('prints one unlabelled value for a token that does not vary', async () => {
    const uniform = entries.find((entry) => !entry.varies && entry.platforms.length === 0);
    const { text } = await run(['tokens', uniform.name], at(dialConsumer()));
    const row = text.split('\n').find((line) => line.startsWith(`  ${uniform.name} `));

    expect(row).toContain(uniform.values[0].value);
    for (const { id } of COMBINATIONS) expect(row, id).not.toContain(id);
  });

  it('marks a token the platform re-points, so a filtered query cannot lie', async () => {
    /* `ds dials` has the full list, but someone asking about one radius asks
       here — and a value with nothing saying it moves on a phone is a wrong
       answer, not a partial one. */
    const overridden = entries.find((entry) => entry.platforms.length > 0);
    const { text } = await run(['tokens', overridden.name], at(dialConsumer()));

    for (const { platform, value } of overridden.platforms) {
      expect(text).toContain(`[${dialAttributeString({ platform })}]`);
      expect(text).toContain(value);
    }
  });

  it('points at `ds dials` and names the default combination', async () => {
    const { text } = await run(['tokens'], at(dialConsumer()));

    expect(text).toContain('ds dials');
    expect(text).toContain(COMBINATIONS[0].id);
  });

  it('falls back to the default combination alone, and says so, on an older tokens', async () => {
    const { text, exitCode } = await run(['tokens'], at(tieredConsumer()));

    // Still answers: one value each is what this package has always printed.
    expect(exitCode).toBe(0);
    expect(text).toContain('var(--signal-500)');
    expect(text).toContain('predates the dial roster');
    expect(text).toContain('pnpm add @elirobinson/tokens@latest');
  });
});

describe('ds contracts / patterns / prompts', () => {
  it('formats contracts, including what verifies each one', async () => {
    const { text } = await run(['contracts'], at(tieredConsumer()));

    expect(text).toContain('minimumTouchTarget: 44x44');
    expect(text).toContain('verified by: checkTouchTargets()');
    expect(text).toContain('no-barrel-imports');
  });

  it('prints patterns.md', async () => {
    expect((await run(['patterns'], at(tieredConsumer()))).text).toContain('# AI Product Patterns');
  });

  it('lists prompts, then prints one by name', async () => {
    const env = at(tieredConsumer());

    expect((await run(['prompts'], env)).text).toContain('audit-page');
    expect((await run(['prompts', 'audit-page'], env)).text).toBe('# Audit');
    expect((await run(['prompts', 'nope'], env)).exitCode).toBe(1);
  });
});

describe('ds init --agents', () => {
  it('installs every agent surface', async () => {
    const root = consumer({});
    const { text, exitCode } = await run(['init', '--agents'], at(root));

    expect(exitCode).toBe(0);
    expect(text).toContain('.claude/skills/design-system/SKILL.md');
    expect(text).toContain('.cursor/rules/design-system.mdc');
    expect(text).toContain('.github/copilot-instructions.md');
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toContain('design system first');
  });

  it('refuses without --agents so a bare `init` cannot surprise anyone', async () => {
    expect((await run(['init'], at(consumer({})))).exitCode).toBe(1);
  });

  it('leaves existing files alone unless forced', async () => {
    const root = consumer({});
    write(root, '.cursor/rules/design-system.mdc', 'mine');

    await run(['init', '--agents'], at(root));
    expect(readFileSync(join(root, '.cursor/rules/design-system.mdc'), 'utf8')).toBe('mine');

    await run(['init', '--agents', '--force'], at(root));
    expect(readFileSync(join(root, '.cursor/rules/design-system.mdc'), 'utf8')).toContain(
      'Design system first',
    );
  });

  it('ships templates that contain no component inventory', async () => {
    const root = consumer({});
    await run(['init', '--agents'], at(root));

    for (const path of [
      '.claude/skills/design-system/SKILL.md',
      '.cursor/rules/design-system.mdc',
      '.github/copilot-instructions.md',
      'AGENTS.md',
    ]) {
      const contents = readFileSync(join(root, path), 'utf8');
      // A list of component names is exactly the thing that goes stale.
      expect(contents).not.toMatch(/SegmentedControl|CommandPalette|VirtualTable/);
      expect(contents).toContain('pnpm ds');
    }
  });

  it("names `warn` as the copy rule's shipped default, never as the level a repo runs at", async () => {
    const root = consumer({});
    await run(['init', '--agents'], at(root));

    for (const path of [
      '.claude/skills/design-system/SKILL.md',
      '.cursor/rules/design-system.mdc',
      '.github/copilot-instructions.md',
      'AGENTS.md',
    ]) {
      const contents = readFileSync(join(root, path), 'utf8');
      // A repo that has raised the severity cannot correct these files — the
      // AGENTS.md block is rewritten wholesale on the next --force, and the
      // other three are whole-file writes. So the claim has to be true at any
      // configured level, and the raise has to be reachable from all four.
      expect(contents).not.toMatch(/eslint-config` warns/);
      expect(contents).toContain("designSystem({ copy: { severity: 'error' } })");
    }
  });
});

describe('AGENTS.md block merging', () => {
  const block = '<!-- design-system:begin -->\nnew\n<!-- design-system:end -->';

  it('appends to a file that has no managed block', () => {
    expect(mergeBlock('# My repo\n', block)).toBe(`# My repo\n\n${block}\n`);
  });

  it('replaces the managed block and preserves everything around it', () => {
    const existing = `# Mine\n\n<!-- design-system:begin -->\nold\n<!-- design-system:end -->\n\n## Tail\n`;

    expect(mergeBlock(existing, block)).toBe(`# Mine\n\n${block}\n\n## Tail\n`);
  });

  it('creates the file from the block when there is nothing there', () => {
    expect(mergeBlock('', block)).toBe(`${block}\n`);
  });
});

describe('argument handling', () => {
  it('prints usage for --help and for an unknown command', async () => {
    const env = at(tieredConsumer());

    expect(await run(['--help'], env)).toMatchObject({ exitCode: 0 });
    expect((await run(['--help'], env)).text).toContain('Usage: ds');
    expect((await run(['nonsense'], env)).exitCode).toBe(1);
  });

  it('reports the installed versions for --version', async () => {
    const { text } = await run(['--version'], at(tieredConsumer()));
    expect(text).toContain('@elirobinson/react@1.1.0');
  });
});

// `ds` reads node_modules on purpose — introspecting installed code is what
// keeps it from going stale. But when node_modules has drifted from the
// lockfile, "what is installed" and "what this repo builds" are different
// versions, and every answer here is about the former. Say so, on stderr, so
// the caution reaches the place the wrong answer is actually consumed.
describe('warning when node_modules disagrees with the lockfile', () => {
  function driftedProject({ installed = '2.0.1', locked = '1.3.0' } = {}) {
    const root = consumer({
      '@elirobinson/react': {
        'package.json': { name: '@elirobinson/react', version: installed },
        'dist/manifest.json': BUTTON_MANIFEST,
      },
    });

    write(root, 'package.json', {
      name: 'consumer',
      dependencies: { '@elirobinson/react': '^1.3.0' },
    });
    write(
      root,
      'pnpm-lock.yaml',
      `importers:\n  .:\n    dependencies:\n      '@elirobinson/react':\n        specifier: ^1.3.0\n        version: ${locked}\n`,
    );

    return root;
  }

  it('names both versions', async () => {
    const { warning } = await run(['props', 'Button'], at(driftedProject()));

    expect(warning).toMatch(/lockfile/i);
    expect(warning).toContain('@elirobinson/react');
    expect(warning).toContain('2.0.1');
    expect(warning).toContain('1.3.0');
  });

  it('keeps the warning out of the command output, which gets piped', async () => {
    const { text, exitCode } = await run(['props', 'Button'], at(driftedProject()));

    expect(text).not.toMatch(/lockfile/i);
    expect(exitCode).toBe(0);
  });

  it('warns on --version too, where the numbers are the whole answer', async () => {
    expect((await run(['--version'], at(driftedProject()))).warning).toContain('2.0.1');
  });

  it('says nothing when the install matches the lockfile', async () => {
    const root = driftedProject({ installed: '1.3.0', locked: '1.3.0' });
    expect((await run(['props', 'Button'], at(root))).warning).toBeUndefined();
  });

  it('says nothing in a project with no lockfile to disagree with', async () => {
    expect((await run([], at(tieredConsumer()))).warning).toBeUndefined();
  });

  it('survives a directory with no package.json at all', async () => {
    const { exitCode, warning } = await run([], {
      origins: [consumer({})],
      cwd: '/nowhere',
      selfDir: patternsRoot,
    });

    expect(exitCode).toBe(0);
    expect(warning).toBeUndefined();
  });
});

describe('the ds binary', () => {
  it('writes the drift warning to stderr, leaving stdout clean for a pipe', () => {
    const root = consumer({
      '@elirobinson/react': {
        'package.json': { name: '@elirobinson/react', version: '2.0.1' },
        'dist/manifest.json': BUTTON_MANIFEST,
      },
    });
    write(root, 'package.json', {
      name: 'consumer',
      dependencies: { '@elirobinson/react': '^1.3.0' },
    });
    write(
      root,
      'pnpm-lock.yaml',
      `importers:\n  .:\n    dependencies:\n      '@elirobinson/react':\n        specifier: ^1.3.0\n        version: 1.3.0\n`,
    );

    const binary = join(patternsRoot, 'src', 'cli', 'cli.mjs');
    const { status, stdout, stderr } = spawnSync(process.execPath, [binary, '--version'], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(stderr).toContain('node_modules disagrees with the lockfile');
    expect(stderr).toContain('1.3.0 locked');
    expect(stdout).toContain('@elirobinson/react@2.0.1');
    expect(stdout).not.toMatch(/lockfile/i);
    // A caveat, not a failure — the command answered the question it was asked.
    expect(status).toBe(0);
  });
});

describe('ds voice', () => {
  it('names which pack is in force, so an inherited voice is visible rather than inferred', async () => {
    const { text, exitCode } = await run(['voice'], at(consumer({})));

    expect(exitCode).toBe(0);
    expect(text).toContain('pack: miltinson');
    expect(text).toContain('default');
    expect(text).toContain('ds init --voice');
  });

  it('renders the pack body, not just its name', async () => {
    expect((await run(['voice'], at(consumer({})))).text).toContain('### Words to avoid');
  });

  it("names the consumer's own pack, and where it came from, once one is declared", async () => {
    const root = consumer({});
    await run(['init', '--voice'], at(root));

    const { text } = await run(['voice'], at(root));
    expect(text).toContain('pack: your-product');
    expect(text).toContain('voice.json');
    expect(text).not.toContain('the system default');
  });

  /* A stack trace here would be the same failure as a silent fallback, one layer up:
     the consumer cannot tell that their own pack is the thing that is wrong. */
  it('fails loudly on a broken pack rather than printing somebody else’s voice', async () => {
    const root = consumer({});
    write(root, 'voice.json', JSON.stringify({ id: 'broken' }));

    const { text, exitCode } = await run(['voice'], at(root));
    expect(exitCode).toBe(1);
    expect(text).toContain('voice.json');
    /* The failing field, named. `{ id: 'broken' }` is missing `label` first. */
    expect(text).toContain('label');
    expect(text).not.toContain('Miltinson');
  });
});

describe('ds init --voice', () => {
  it('scaffolds a starter that carries the schema and nobody’s brand', async () => {
    const root = consumer({});
    const { text, exitCode } = await run(['init', '--voice'], at(root));

    expect(exitCode).toBe(0);
    expect(text).toContain('voice.json');

    const written = readFileSync(join(root, 'voice.json'), 'utf8');
    expect(JSON.parse(written).id).toBe('your-product');
    expect(written).not.toMatch(/miltinson/i);
  });

  /* Not even with --force. A consumer's voice is hand-written prose with no other copy;
     the agents templates are regenerable and this is not. */
  it('refuses to overwrite an existing voice.json, and --force is no escape', async () => {
    const root = consumer({});
    write(root, 'voice.json', '{ "id": "mine" }');

    for (const argv of [
      ['init', '--voice'],
      ['init', '--voice', '--force'],
    ]) {
      const { exitCode } = await run(argv, at(root));
      expect(exitCode, argv.join(' ')).toBe(1);
      expect(readFileSync(join(root, 'voice.json'), 'utf8')).toBe('{ "id": "mine" }');
    }
  });

  it('still refuses a bare `init`, now that two flags exist', async () => {
    const { text, exitCode } = await run(['init'], at(consumer({})));

    expect(exitCode).toBe(1);
    expect(text).toContain('--agents');
    expect(text).toContain('--voice');
  });
});
