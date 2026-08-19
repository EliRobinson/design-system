/* `ds-resync migrate` against a repo that looks like a real one.
 *
 * The unit tests beside this file pin each decision in isolation. This one
 * exists because a codemod that passes unit tests and mangles a real stylesheet
 * is the normal outcome, not an unlucky one: the interesting failures are all
 * about a token appearing twice in one file meaning two different things.
 *
 * So the fixture is written the way a consumer writes: the same token used
 * correctly and incorrectly a few lines apart, an alias through the app's own
 * custom property, a ternary in a JSX style object, and `--fg-inverse` doing
 * exactly the job it is for on an inverted band. The assertions are on the
 * before and the after — the actual bytes — not on the shape of the report.
 *
 * The manifest is the REAL one from @elirobinson/tokens, copied into a fake
 * node_modules. A fixture with a hand-written manifest would prove the engine
 * works on a manifest nobody ships.
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

import { main } from './cli.mjs';

const TOKENS_SRC = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'tokens',
  'src',
  'migrations.json',
);

/* Written the way an app under upgrade actually looks. Every line here is
   either something the tool must fix, something it must refuse to fix, or
   something it must leave completely alone — and the third group is the one
   that decides whether anybody keeps the tool switched on. */
const GLOBALS_CSS = `@import '@elirobinson/tokens/tokens.css';
@import '@elirobinson/react/styles.css';

/* 1. WRONG: the 1.87:1 fill asked to carry a 3:1 line. */
.pricing-callout {
  background: var(--status-warning-tint);
  border: 1px solid var(--status-warning);
  border-radius: var(--radius-2);
}

/* 2. RIGHT: a warning FILL is still --status-warning. Must not be touched. */
.pricing-callout__flag {
  background: var(--status-warning);
  color: var(--ink-1000);
}

/* 3. WRONG: a legacy alias that collapses under a second palette. */
.upgrade-button {
  background: var(--accent);
  color: var(--fg-on-signal);
}

/* 4. REFUSE: aliased into the app's own variable. What this paints is not
   visible from here — it is used as a border below and as a fill elsewhere. */
:root {
  --app-callout-edge: var(--status-warning);
}

/* 5. WRONG, but only a human can pick the state: theme-flipping text on a
   status fill. */
.toast--danger {
  background: var(--status-danger);
  color: var(--fg-inverse);
  border-radius: var(--radius-3);
}

/* 6. RIGHT: --fg-inverse on an inverted band is exactly what it is for. */
.site-footer {
  background: var(--bg-inverse);
  color: var(--fg-inverse);
}

/* 7. Silent: the neutral ramp was re-dialled with no rendered change. */
.meta {
  color: var(--ink-500);
}

/* 8. Counted, not listed: a status hue that was tuned. */
.hint {
  color: var(--status-info-fg);
}
`;

const ALERT_TSX = `import type { ReactNode } from 'react';

export function Alert({ hot, children }: { hot: boolean; children: ReactNode }) {
  return (
    <div
      className="alert"
      style={{
        borderColor: 'var(--status-warning)',
        color: 'var(--fg-on-signal)',
      }}
    >
      <span style={{ borderBottomColor: hot ? 'var(--border-strong)' : 'var(--status-warning)' }}>
        {children}
      </span>
    </div>
  );
}
`;

function makeConsumer() {
  const dir = mkdtempSync(join(tmpdir(), 'ds-migrate-fixture-'));

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'shop', dependencies: { '@elirobinson/tokens': '^0.9.0' } }, null, 2),
  );

  // The installed package, carrying the manifest this command reads.
  const installed = join(dir, 'node_modules', '@elirobinson', 'tokens');
  mkdirSync(join(installed, 'src'), { recursive: true });
  writeFileSync(
    join(installed, 'package.json'),
    JSON.stringify({ name: '@elirobinson/tokens', version: '0.9.0' }, null, 2),
  );
  cpSync(TOKENS_SRC, join(installed, 'src', 'migrations.json'));

  // What `ds-resync --write` left behind, so `migrate` needs no arguments.
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(
    join(dir, '.claude', 'ds-resync.json'),
    JSON.stringify(
      { upgrades: { '@elirobinson/tokens': { from: '0.8.0', to: '0.9.0' } } },
      null,
      2,
    ),
  );

  mkdirSync(join(dir, 'app', 'components'), { recursive: true });
  writeFileSync(join(dir, 'app', 'globals.css'), GLOBALS_CSS);
  writeFileSync(join(dir, 'app', 'components', 'Alert.tsx'), ALERT_TSX);

  // A generated tree that must never be walked into.
  mkdirSync(join(dir, '.next', 'static'), { recursive: true });
  writeFileSync(
    join(dir, '.next', 'static', 'app.css'),
    '.x { border-color: var(--status-warning) }',
  );

  return dir;
}

async function run(dir, argv) {
  const chunks = [];
  const write = process.stdout.write;
  process.stdout.write = (chunk) => {
    chunks.push(String(chunk));
    return true;
  };

  try {
    const code = await main(['migrate', '--cwd', dir, ...argv]);
    return { code, output: chunks.join('') };
  } finally {
    process.stdout.write = write;
  }
}

describe('ds-resync migrate against a fixture consumer', () => {
  let dir;

  beforeEach(() => {
    dir = makeConsumer();
  });

  it('changes nothing without --write', async () => {
    const { output } = await run(dir, ['--json']);
    const result = JSON.parse(output);

    expect(result.rewrites.length).toBeGreaterThan(0);
    expect(result.wrote).toBe(false);
    expect(readFileSync(join(dir, 'app', 'globals.css'), 'utf8')).toBe(GLOBALS_CSS);
    expect(readFileSync(join(dir, 'app', 'components', 'Alert.tsx'), 'utf8')).toBe(ALERT_TSX);
  });

  it('crosses only the range the upgrade record names', async () => {
    const { output } = await run(dir, ['--json']);
    const [pkg] = JSON.parse(output).packages;

    expect(pkg).toMatchObject({ name: '@elirobinson/tokens', from: '0.8.0', to: '0.9.0' });
    expect(pkg.migrations).toContain('warning-needs-an-edge');
  });

  it('rewrites the warning edge and leaves the warning fill alone', async () => {
    await run(dir, ['--write']);
    const css = readFileSync(join(dir, 'app', 'globals.css'), 'utf8');

    // 1 — the edge moved.
    expect(css).toContain('border: 1px solid var(--status-warning-border);');
    // 2 — the fill did not. This is the assertion that a blind rename fails.
    expect(css).toContain('background: var(--status-warning);');
  });

  it('renames the legacy alias wherever it appears', async () => {
    await run(dir, ['--write']);
    const css = readFileSync(join(dir, 'app', 'globals.css'), 'utf8');

    expect(css).toContain('color: var(--accent-fg);');
    expect(css).not.toContain('var(--fg-on-signal)');
  });

  it('refuses to rewrite through the app’s own custom property', async () => {
    const { output } = await run(dir, ['--write']);
    const css = readFileSync(join(dir, 'app', 'globals.css'), 'utf8');

    expect(css).toContain('--app-callout-edge: var(--status-warning);');
    expect(output).toContain('--app-callout-edge');
    expect(output).toMatch(/assigned to one of your own custom properties/);
  });

  it('reports the theme-flipping foreground instead of guessing the state', async () => {
    const { output } = await run(dir, ['--write']);
    const css = readFileSync(join(dir, 'app', 'globals.css'), 'utf8');

    expect(css).toContain(
      '.toast--danger {\n  background: var(--status-danger);\n  color: var(--fg-inverse);',
    );
    expect(output).toContain('--status-<state>-on');
  });

  it('says nothing about --fg-inverse on an inverted band', async () => {
    const { output } = await run(dir, ['--json']);
    const result = JSON.parse(output);

    const footer = [...result.rewrites, ...result.review].filter(
      (item) => item.line >= 44 && item.line <= 48,
    );
    expect(footer).toEqual([]);
  });

  it('says nothing at all about the re-dialled neutral ramp', async () => {
    const { output } = await run(dir, ['--json']);
    const result = JSON.parse(output);

    const inks = [...result.rewrites, ...result.review, ...result.summary].filter(
      (item) => item.token === '--ink-500' || item.migration === 'neutral-ramp-dialled',
    );
    expect(inks).toEqual([]);
  });

  it('counts the tuned hues rather than listing them', async () => {
    const { output } = await run(dir, ['--json']);
    const result = JSON.parse(output);

    expect(result.summary).toContainEqual(
      expect.objectContaining({ migration: 'status-hues-tuned', count: 3 }),
    );
    expect(result.review.some((item) => item.token === '--status-info-fg')).toBe(false);
  });

  it('normalises a JSX style key and rewrites through it', async () => {
    await run(dir, ['--write']);
    const tsx = readFileSync(join(dir, 'app', 'components', 'Alert.tsx'), 'utf8');

    expect(tsx).toContain("borderColor: 'var(--status-warning-border)'");
    expect(tsx).toContain("color: 'var(--accent-fg)'");
  });

  it('refuses the ternary branch whose property it cannot read', async () => {
    const { output } = await run(dir, ['--write']);
    const tsx = readFileSync(join(dir, 'app', 'components', 'Alert.tsx'), 'utf8');

    expect(tsx).toContain("hot ? 'var(--border-strong)' : 'var(--status-warning)'");
    expect(output).toMatch(/CSS property could not be established/);
  });

  it('never walks into a generated tree', async () => {
    await run(dir, ['--write']);
    expect(readFileSync(join(dir, '.next', 'static', 'app.css'), 'utf8')).toContain(
      'var(--status-warning)',
    );
  });

  it('exits 2 under --fail-on-pending while anything is left for a human', async () => {
    const { code } = await run(dir, ['--fail-on-pending']);
    expect(code).toBe(2);
  });

  it('is idempotent — a second --write finds nothing left to rewrite', async () => {
    await run(dir, ['--write']);
    const after = readFileSync(join(dir, 'app', 'globals.css'), 'utf8');

    const { output } = await run(dir, ['--write', '--json']);
    expect(JSON.parse(output).rewrites).toEqual([]);
    expect(readFileSync(join(dir, 'app', 'globals.css'), 'utf8')).toBe(after);
  });
});
