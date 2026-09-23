// @vitest-environment node
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REVIEWERS } from './review-gate-policy.mjs';
import { CREATE, GH, filledReview } from './review-gate-fixtures';

// End-to-end: runs the hook script with each tool's stdin format, in a
// throwaway git repo. The rules themselves are covered in
// review-gate-policy.test.ts.

const HOOK = fileURLToPath(new URL('./review-gate.mjs', import.meta.url));

let repo: string;

const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd: repo,
    stdio: 'ignore',
  });

function run(agent: string, event: unknown) {
  const result = spawnSync('node', [HOOK, `--agent=${agent}`], {
    input: typeof event === 'string' ? event : JSON.stringify(event),
    cwd: repo,
    encoding: 'utf8',
  });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    // Not a JSON reply.
  }
  return { code: result.status, stderr: result.stderr, json };
}

const bash = (command: string) => ({
  tool_name: 'Bash',
  tool_input: { command },
  cwd: repo,
});
const stop = (agent: string, output = 'No findings.') => ({
  hook_event_name: 'SubagentStop',
  agent_type: agent,
  last_assistant_message: output,
  cwd: repo,
});
const finishAllReviewers = () => {
  for (const { agent } of REVIEWERS) expect(run('claude', stop(agent)).code).toBe(0);
};
const openPr = (flags = '') => run('claude', bash(`${CREATE} -F body.md ${flags}`));

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'review-gate-'));
  git('init', '-q', '-b', 'main');
  git('commit', '-q', '--allow-empty', '-m', 'base');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('checkout', '-q', '-b', 'feat/x');
  git('commit', '-q', '--allow-empty', '-m', 'work');
  writeFileSync(join(repo, 'body.md'), filledReview());
  writeFileSync(join(repo, 'empty.md'), '## Summary\nx');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('Claude Code', () => {
  it('blocks the PR until every reviewer has finished on the branch', () => {
    const first = openPr();
    expect(first.code).toBe(2);
    for (const { agent } of REVIEWERS) expect(first.stderr).toContain(agent);

    finishAllReviewers();
    expect(openPr().code).toBe(0);
  });

  it('records reviewers that finish at the same moment', async () => {
    await Promise.all(
      REVIEWERS.map(
        ({ agent }) =>
          new Promise((resolve) => {
            const child = spawn('node', [HOOK, '--agent=claude'], { cwd: repo });
            child.on('close', resolve);
            child.stdin.end(JSON.stringify(stop(agent)));
          }),
      ),
    );
    expect(openPr().code).toBe(0);
  });

  it('does not count a reviewer that returned nothing', () => {
    for (const { agent } of REVIEWERS)
      run('claude', stop(agent, agent === 'review-dry' ? '' : 'ok'));
    const result = openPr();
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/review-dry/);
  });

  it('keeps branch runs apart, even for names that look alike', () => {
    finishAllReviewers();
    git('checkout', '-q', '-b', 'feat_x');
    expect(openPr().code).toBe(2);
  });

  it('still counts runs after fix commits', () => {
    finishAllReviewers();
    git('commit', '-q', '--allow-empty', '-m', 'fix a finding');
    expect(openPr().code).toBe(0);
  });

  it('drops runs made before the branch had its own commits', () => {
    git('checkout', '-q', '-b', 'fresh', 'main');
    finishAllReviewers();
    git('commit', '-q', '--allow-empty', '-m', 'work');
    expect(openPr().code).toBe(2);
  });

  it('drops runs from a branch that was deleted and recreated', () => {
    finishAllReviewers();
    git('checkout', '-q', 'main');
    git('branch', '-q', '-D', 'feat/x');
    git('checkout', '-q', '-b', 'feat/x');
    git('commit', '-q', '--allow-empty', '-m', 'new work');
    expect(openPr().code).toBe(2);
  });

  it('checks the runs of the --head branch against the --base branch', () => {
    finishAllReviewers();
    git('update-ref', 'refs/remotes/origin/dev', 'feat/x');
    git('checkout', '-q', '-b', 'other');
    expect(openPr('--head feat/x').code).toBe(0);
    expect(openPr('--head feat/x --base dev').code).toBe(2);
    expect(openPr().code).toBe(2);
  });

  it('resolves the body file after a leading cd', () => {
    finishAllReviewers();
    mkdirSync(join(repo, 'sub'));
    expect(run('claude', bash(`cd sub && ${CREATE} -F ../body.md`)).code).toBe(0);
  });

  it('follows a leading cd to an absolute path', () => {
    finishAllReviewers();
    expect(run('claude', bash(`cd ${repo} && ${CREATE} -F body.md`)).code).toBe(0);
    const elsewhere = run('claude', {
      ...bash(`cd ${repo} && ${CREATE} -F body.md`),
      cwd: '/',
    });
    expect(elsewhere.code).toBe(0);
  });

  it('blocks a reviewer started with a model override', () => {
    const start = (input: object) =>
      run('claude', {
        tool_name: 'Agent',
        tool_input: { prompt: 'x', ...input },
        cwd: repo,
      });
    expect(start({ subagent_type: 'review-dry', model: 'fable' }).code).toBe(2);
    expect(start({ subagent_type: 'review-dry' }).code).toBe(0);
  });

  it('checks MCP create_pull_request bodies', () => {
    finishAllReviewers();
    const mcp = (body: string) =>
      run('claude', {
        tool_name: 'mcp__github__create_pull_request',
        tool_input: { body, head: 'feat/x' },
        cwd: repo,
      }).code;
    expect(mcp('')).toBe(2);
    expect(mcp(filledReview())).toBe(0);
  });

  it('does not block MCP tools that only review a PR', () => {
    const review = run('claude', {
      tool_name: 'mcp__github__create_pull_request_review',
      tool_input: { body: 'LGTM' },
      cwd: repo,
    });
    expect(review.code).toBe(0);
  });

  it('reads graphql query files', () => {
    writeFileSync(
      join(repo, 'm.graphql'),
      'mutation { createPullRequest(input: {}) { clientMutationId } }',
    );
    expect(run('claude', bash(`${GH} api graphql -f query=@m.graphql`)).code).toBe(2);
  });

  it('lets bad stdin and unrelated tools through', () => {
    expect(run('claude', 'not json').code).toBe(0);
    expect(run('claude', { tool_name: 'Read', tool_input: {}, cwd: repo }).code).toBe(0);
    expect(run('claude', bash('ls -la')).code).toBe(0);
  });
});

describe('other tools check the body only', () => {
  it('Codex: with a string or argv command', () => {
    expect(run('codex', bash(`${CREATE} -F body.md`)).code).toBe(0);
    expect(run('codex', bash(`${CREATE} -F empty.md`)).code).toBe(2);
    const argv = (command: string[]) =>
      run('codex', { tool_name: 'Bash', tool_input: { command }, cwd: repo }).code;
    expect(argv(['bash', '-lc', `${CREATE} -F empty.md`])).toBe(2);
    expect(argv(['bash', '-lc', `cd ${repo} && ${CREATE} -F body.md`])).toBe(0);
    writeFileSync(join(repo, 'my body.md'), filledReview());
    expect(argv([GH, 'pr', 'create', '-F', 'my body.md'])).toBe(0);
  });

  it('Gemini: shell and MCP calls', () => {
    const shell = (command: string) =>
      run('gemini', {
        tool_name: 'run_shell_command',
        tool_input: { command },
        cwd: repo,
      }).code;
    expect(shell(`${CREATE} -F body.md`)).toBe(0);
    expect(shell(`${CREATE} --fill`)).toBe(2);
    const mcp = run('gemini', {
      tool_name: 'mcp_github_create_pull_request',
      tool_input: { body: '' },
      cwd: repo,
    });
    expect(mcp.code).toBe(2);
  });

  it('Cursor: denies with JSON on stdout, for shell and MCP', () => {
    expect(run('cursor', { command: `${CREATE} -F body.md`, cwd: repo }).json).toBeNull();
    const shell = run('cursor', { command: `${CREATE} -F empty.md`, cwd: repo });
    expect(shell.code).toBe(0);
    expect(shell.json).toMatchObject({ permission: 'deny' });
    const mcp = run('cursor', {
      tool_name: 'create_pull_request',
      tool_input: JSON.stringify({ body: '' }),
      cwd: repo,
    });
    expect(mcp.json).toMatchObject({ permission: 'deny' });
  });

  it('Copilot: denies with JSON on stdout, with object or string toolArgs', () => {
    const call = (toolArgs: unknown) => run('copilot', { toolName: 'bash', toolArgs, cwd: repo });
    expect(call({ command: `${CREATE} -F body.md` }).json).toBeNull();
    expect(call(JSON.stringify({ command: `${CREATE} -F empty.md` })).json).toMatchObject({
      permissionDecision: 'deny',
    });
  });
});

it('fails loudly on an unknown --agent', () => {
  const result = run('claud', bash('ls'));
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/unknown --agent/);
});
