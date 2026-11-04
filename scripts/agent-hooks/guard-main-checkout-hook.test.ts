// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { OVERRIDE, mainCheckoutOf } from './guard-main-checkout-policy.mjs';

// End-to-end: runs the hook script the way Claude Code does. The hook guards
// the main checkout of the repo it sits in, so these tests point `cwd` at that
// real folder. The hook only decides; nothing in the commands below runs.
// The rules themselves are covered in guard-main-checkout-policy.test.ts.

const HOOK = fileURLToPath(new URL('./guard-main-checkout.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../..', import.meta.url));
const MAIN = mainCheckoutOf(REPO);
const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), 'guard-hook-')));

afterAll(() => rmSync(elsewhere, { recursive: true, force: true }));

function run(stdin: unknown, env: Record<string, string> = {}) {
  const result = spawnSync('node', [HOOK], {
    input: typeof stdin === 'string' ? stdin : JSON.stringify(stdin),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { code: result.status, stderr: result.stderr };
}

const bash = (command: string, cwd = MAIN) => ({
  tool_name: 'Bash',
  tool_input: { command },
  cwd,
});

describe('guard-main-checkout hook', () => {
  it('finds a main checkout for the repo it sits in', () => {
    expect(MAIN).not.toBeNull();
  });

  it('refuses tree-changing git in the main checkout with exit 2', () => {
    const { code, stderr } = run(bash('git add -A'));
    expect(code).toBe(2);
    expect(stderr).toContain('git add');
    expect(stderr).toContain(`${OVERRIDE}=1`);
  });

  it("refuses an alias from git's own config", () => {
    const config = join(elsewhere, 'gitconfig');
    writeFileSync(config, '[alias]\n\tzzcm = commit -m\n');
    const { code, stderr } = run(bash('git zzcm wip'), { GIT_CONFIG_GLOBAL: config });
    expect(code).toBe(2);
    expect(stderr).toContain('`git zzcm` (an alias for `git commit`)');
  });

  it('ignores the escape in its own environment', () => {
    expect(run(bash('git commit -m x'), { [OVERRIDE]: '1' }).code).toBe(2);
  });

  it('allows reads in the main checkout', () => {
    expect(run(bash('git status && git fetch origin'))).toEqual({ code: 0, stderr: '' });
  });

  it('allows tree-changing git outside the main checkout', () => {
    expect(run(bash('git add -A', elsewhere))).toEqual({ code: 0, stderr: '' });
  });

  it('ignores tools other than Bash', () => {
    const event = { tool_name: 'Edit', tool_input: { command: 'git add -A' }, cwd: MAIN };
    expect(run(event)).toEqual({ code: 0, stderr: '' });
  });

  it('allows empty stdin', () => {
    expect(run('')).toEqual({ code: 0, stderr: '' });
  });

  it('fails open on its own crash, and says so on stderr', () => {
    const { code, stderr } = run('{not json');
    expect(code).toBe(0);
    expect(stderr).toContain('guard-main-checkout: hook crashed, allowing the call');
  });
});

describe('.claude/settings.json', () => {
  const hooks = JSON.parse(readFileSync(join(REPO, '.claude/settings.json'), 'utf8')).hooks;

  it('runs the guard on every Bash call, next to the review gate', () => {
    const entries: Array<{ matcher: string; hooks: Array<{ command: string }> }> = hooks.PreToolUse;
    const guard = entries.find((entry) =>
      entry.hooks.some((hook) => hook.command.includes('guard-main-checkout.mjs')),
    );
    expect(guard).toBeDefined();
    expect(new RegExp(`^(?:${guard?.matcher})$`).test('Bash')).toBe(true);
    expect(guard?.hooks[0]?.command).toBe(
      'node "$CLAUDE_PROJECT_DIR/scripts/agent-hooks/guard-main-checkout.mjs"',
    );
  });
});
