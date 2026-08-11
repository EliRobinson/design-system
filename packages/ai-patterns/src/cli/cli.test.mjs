// The CLI's job is to describe whatever is installed, whatever shape it takes.
// These fixtures build node_modules trees by hand so each layout the CLI has to
// survive — tiered with a manifest, flat without one, nothing installed at all —
// is exercised directly rather than assumed.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  // `pnpm dlx @elirobinson/ai-patterns elirobinson-ds` runs the binary from a
  // throwaway store, so this package is absent from the project it is
  // describing. Its own data must still be readable.
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

    it('still describes the project it is pointed at', () => {
      const { text } = run([], at(project()));

      expect(text).toContain('COMPONENTS (1)');
      expect(text).toContain('@elirobinson/react@1.1.0');
    });

    it('falls back to its own package for contracts, patterns and prompts', () => {
      const env = at(project());

      expect(run(['contracts'], env)).toMatchObject({ exitCode: 0 });
      expect(run(['contracts'], env).text).toContain('no-barrel-imports');
      expect(run(['patterns'], env).text).toContain('AI Product Patterns');
      expect(run(['prompts'], env).text).toContain('adopt-system');
    });

    it('does not claim to be uninstalled when it is the thing running', () => {
      expect(run([], at(project())).text).not.toContain('@elirobinson/ai-patterns (not installed)');
    });

    it('still reports a genuinely missing package', () => {
      const { text } = run([], { origins: [consumer({})], cwd: '/nowhere', selfDir: patternsRoot });

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
  it('reports installed versions, components, hooks, classes and tokens', () => {
    const { text, exitCode } = run([], at(tieredConsumer()));

    expect(exitCode).toBe(0);
    expect(text).toContain('@elirobinson/react@1.1.0');
    expect(text).toContain('COMPONENTS (1)');
    expect(text).toContain('variant: primary|ghost');
    expect(text).toContain('useEscapeKey');
    expect(text).toContain('t-h1');
    expect(text).toContain('TOKENS  2 custom properties');
  });

  it('groups a tiered layout by tier', () => {
    expect(run([], at(tieredConsumer())).text).toContain('atoms/');
  });

  it('describes a flat layout without inventing a tier, and says the source', () => {
    const { text } = run([], at(flatConsumer()));

    expect(text).toContain('COMPONENTS (2)');
    expect(text).not.toContain('atoms/');
    expect(text).toContain('recovered from emitted declarations');
  });

  it('names what to install when packages are missing, and still exits 0', () => {
    const { text, exitCode } = run([], at(consumer({})));

    expect(exitCode).toBe(0);
    expect(text).toContain('@elirobinson/react (not installed)');
    expect(text).toContain('pnpm add @elirobinson/react@latest @elirobinson/tokens@latest');
  });
});

describe('ds props', () => {
  it('accepts a bare name and prints the exact import specifier', () => {
    const { text, exitCode } = run(['props', 'Button'], at(tieredConsumer()));

    expect(exitCode).toBe(0);
    expect(text).toContain("import { Button } from '@elirobinson/react/components/atoms/Button';");
    expect(text).toContain('variant (ButtonVariant): "primary" | "ghost"');
  });

  it('accepts the full subpath', () => {
    const { text } = run(['props', 'atoms/Button'], at(tieredConsumer()));
    expect(text).toContain("'@elirobinson/react/components/atoms/Button'");
  });

  it('treats a capitalised bare argument as a props lookup', () => {
    expect(run(['Button'], at(tieredConsumer())).text).toContain(
      "'@elirobinson/react/components/atoms/Button'",
    );
  });

  it('prints the specifier the installed layout actually uses', () => {
    expect(run(['props', 'Button'], at(flatConsumer())).text).toContain(
      "'@elirobinson/react/components/Button'",
    );
  });

  it('lists what is available when the name is wrong', () => {
    const { text, exitCode } = run(['props', 'Nope'], at(tieredConsumer()));

    expect(exitCode).toBe(1);
    expect(text).toContain('No component named "Nope"');
    expect(text).toContain('atoms/Button');
  });
});

describe('ds tokens / classes', () => {
  it('prints every token with its value', () => {
    const { text } = run(['tokens'], at(tieredConsumer()));
    expect(text).toContain('--accent');
    expect(text).toContain('var(--signal-500)');
  });

  it('filters by name or value', () => {
    expect(run(['tokens', 'accent'], at(tieredConsumer())).text).not.toContain('--bg ');
    expect(run(['tokens', 'signal'], at(tieredConsumer())).text).toContain('--accent');
  });

  it('exits 1 when a filter matches nothing', () => {
    expect(run(['tokens', 'nonesuch'], at(tieredConsumer())).exitCode).toBe(1);
  });

  it('lists classes from both the tokens and component stylesheets', () => {
    const { text } = run(['classes'], at(tieredConsumer()));
    expect(text).toContain('t-h1');
    expect(text).toContain('ds-button');
  });
});

describe('ds contracts / patterns / prompts', () => {
  it('formats contracts, including what verifies each one', () => {
    const { text } = run(['contracts'], at(tieredConsumer()));

    expect(text).toContain('minimumTouchTarget: 44x44');
    expect(text).toContain('verified by: checkTouchTargets()');
    expect(text).toContain('no-barrel-imports');
  });

  it('prints patterns.md', () => {
    expect(run(['patterns'], at(tieredConsumer())).text).toContain('# AI Product Patterns');
  });

  it('lists prompts, then prints one by name', () => {
    const env = at(tieredConsumer());

    expect(run(['prompts'], env).text).toContain('audit-page');
    expect(run(['prompts', 'audit-page'], env).text).toBe('# Audit');
    expect(run(['prompts', 'nope'], env).exitCode).toBe(1);
  });
});

describe('ds init --agents', () => {
  it('installs every agent surface', () => {
    const root = consumer({});
    const { text, exitCode } = run(['init', '--agents'], at(root));

    expect(exitCode).toBe(0);
    expect(text).toContain('.claude/skills/design-system/SKILL.md');
    expect(text).toContain('.cursor/rules/design-system.mdc');
    expect(text).toContain('.github/copilot-instructions.md');
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toContain('design system first');
  });

  it('refuses without --agents so a bare `init` cannot surprise anyone', () => {
    expect(run(['init'], at(consumer({}))).exitCode).toBe(1);
  });

  it('leaves existing files alone unless forced', () => {
    const root = consumer({});
    write(root, '.cursor/rules/design-system.mdc', 'mine');

    run(['init', '--agents'], at(root));
    expect(readFileSync(join(root, '.cursor/rules/design-system.mdc'), 'utf8')).toBe('mine');

    run(['init', '--agents', '--force'], at(root));
    expect(readFileSync(join(root, '.cursor/rules/design-system.mdc'), 'utf8')).toContain(
      'Design system first',
    );
  });

  it('ships templates that contain no component inventory', () => {
    const root = consumer({});
    run(['init', '--agents'], at(root));

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
  it('prints usage for --help and for an unknown command', () => {
    const env = at(tieredConsumer());

    expect(run(['--help'], env)).toMatchObject({ exitCode: 0 });
    expect(run(['--help'], env).text).toContain('Usage: ds');
    expect(run(['nonsense'], env).exitCode).toBe(1);
  });

  it('reports the installed versions for --version', () => {
    const { text } = run(['--version'], at(tieredConsumer()));
    expect(text).toContain('@elirobinson/react@1.1.0');
  });
});
