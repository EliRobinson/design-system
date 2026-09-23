// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REVIEWERS,
  TOOLS,
  branchRefsOf,
  countsAsRun,
  decidePr,
  decideReviewerStart,
  findPrCommands,
  isMcpCreatePr,
  prCommandsOf,
  reviewersWithoutRun,
  unfilledReviewLabels,
} from './review-gate-policy.mjs';
import { CREATE, GH, filledReview } from './review-gate-fixtures';

// This file lives at scripts/agent-hooks/, two levels below the repo root.
// Reads below are repo-root-relative, not cwd-relative: nx runs this
// project's `test` target with cwd `scripts/`, and vitest's own root is the
// directory holding this config, so a plain relative path would resolve
// against the wrong directory.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const atRoot = (path: string) => join(repoRoot, path);

const kinds = (script: string) => findPrCommands(script).map((pr) => pr.kind);
const first = (script: string) => findPrCommands(script)[0];
const labels = REVIEWERS.map(({ label }) => label);
const agents = REVIEWERS.map(({ agent }) => agent);
const firstAgent = REVIEWERS[0].agent;

describe('findPrCommands: detects PR-opening commands', () => {
  it.each([
    ['plain', `${CREATE} --title x --body-file b.md`],
    ['alias', `${GH} pr new --body-file b.md`],
    ['repo flag before the subcommand', `${GH} pr -R o/r create -F b.md`],
    ['repo= flag before the subcommand', `${GH} pr --repo=o/r create -F b.md`],
    ['after &&', `cd repo && ${CREATE} -F b.md`],
    ['env prefix', `GH_TOKEN=x ${CREATE} -F b.md`],
    ['wrapper with a flag value', `sudo -u me ${CREATE} -F b.md`],
    ['timeout', `timeout 60 ${CREATE} -F b.md`],
    ['bash -c', `bash -c "${CREATE} -F b.md"`],
    ['eval', `eval "${CREATE} -F b.md"`],
    ['substitution in quotes', `echo "$(${CREATE} -F b.md)"`],
    ['backticks', `echo \`${CREATE} -F b.md\``],
    ['split quotes', `g''h pr create -F b.md`],
    ['full path', `/opt/homebrew/bin/${CREATE} -F b.md`],
    ['after a here-string', `grep -q x <<< foo\n${CREATE} --fill`],
    ['after a quoted <<', `echo "a <<Z"\n${CREATE} --fill`],
    ['help=false', `${CREATE} --help=false --fill`],
    ['repo flag before pr', `${GH} -R o/r pr create -F b.md`],
    ['in a function', `function f { ${CREATE} -F b.md; }; f`],
    ['after arithmetic with a shift', `(( n = 1 << 2 ))\n${CREATE} --fill`],
  ])('%s', (_, script) => {
    expect(kinds(script)).toEqual(['pr-create']);
  });

  it.each([
    ['POST with fields', `${GH} api repos/o/r/pulls -f title=x -f head=b`],
    ['attached field values', `${GH} api repos/o/r/pulls -ftitle=x -fhead=b`],
    ['explicit POST', `${GH} api -X POST repos/o/r/pulls --input body.json`],
    ['method flag', `${GH} api --method=post /repos/o/r/pulls`],
    ['full URL', `${GH} api https://api.github.com/repos/o/r/pulls -f title=x`],
    ['attached method', `${GH} api -XPOST repos/o/r/pulls`],
    [
      'inline graphql mutation',
      `${GH} api graphql -f query='mutation{createPullRequest(input:{}){clientMutationId}}'`,
    ],
    ['POST after a GET', `${GH} api repos/o/r/pulls/1 && ${GH} api -X POST repos/o/r/pulls`],
  ])('gh api: %s', (_, script) => {
    expect(kinds(script)).toContain('api-create');
  });

  it('flags graphql calls that read the query from a file', () => {
    expect(first(`${GH} api graphql -f query=@m.graphql`)).toEqual({
      kind: 'graphql-files',
      files: ['m.graphql'],
      dir: undefined,
    });
    expect(first(`cd sub && ${GH} api graphql --input m.json`)).toMatchObject({
      files: ['m.json'],
      dir: 'sub',
    });
  });
});

describe('findPrCommands: leaves other commands alone', () => {
  it.each([
    ['ls', 'ls -la'],
    ['pr view', `${GH} pr view 18`],
    ['help', `${CREATE} --help`],
    ['short help', `${CREATE} -h`],
    ['dry run', `${CREATE} --dry-run -F b.md`],
    ['echoed', `echo "${CREATE} --fill"`],
    ['single-quoted', `echo '${CREATE}'`],
    ['grep pattern with a paren', `rg -n "(${CREATE}|foo)" docs`],
    ['comment', `ls # ${CREATE}`],
    ['heredoc body', `cat > notes.md <<'EOF'\n${CREATE} --web\nEOF\necho done`],
    ['GET pulls list', `${GH} api repos/o/r/pulls --jq '.[].number'`],
    ['GET commit pulls', `${GH} api repos/o/r/commits/abc/pulls`],
    ['POST a comment', `${GH} api repos/o/r/pulls/18/comments -f body=hi`],
    ['inline graphql query', `${GH} api graphql -f query='{viewer{login}}'`],
  ])('%s', (_, script) => {
    expect(kinds(script)).toEqual([]);
  });
});

describe('findPrCommands: reads pr create flags', () => {
  it('reads the body file, head, and base, long and short', () => {
    expect(first(`${CREATE} --body-file=b.md --head=feat --base=dev`)).toMatchObject({
      bodyFile: 'b.md',
      head: 'feat',
      base: 'dev',
    });
    expect(first(`${CREATE} -F "my body.md" -H feat -B dev`)).toMatchObject({
      bodyFile: 'my body.md',
      head: 'feat',
      base: 'dev',
    });
    expect(first(`${CREATE} -Fb.md`)).toMatchObject({ bodyFile: 'b.md' });
    expect(first(`${CREATE} -dF b.md`)).toMatchObject({ bodyFile: 'b.md' });
    expect(first(`${CREATE} -F b.md --head=0`)).toMatchObject({ head: '0' });
  });

  it('does not read a flag out of a flag value', () => {
    expect(first(`${CREATE} --title "Add -F flag" -F b.md`)).toMatchObject({
      bodyFile: 'b.md',
    });
    expect(first(`${CREATE} -t "drop --web" -F b.md`)).toMatchObject({
      web: false,
    });
  });

  it('sees fill and web flags, and ignores =false', () => {
    expect(first(`${CREATE} -f`)).toMatchObject({ fill: true });
    expect(first(`${CREATE} --fill-first`)).toMatchObject({ fill: true });
    expect(first(`${CREATE} -w`)).toMatchObject({ web: true });
    expect(first(`${CREATE} -fw`)).toMatchObject({ fill: true, web: true });
    expect(first(`${CREATE} -F b.md --fill=false`)).toMatchObject({
      fill: false,
    });
  });

  it('tracks the directory the leading cd commands move to', () => {
    const dir = (script: string) => (first(script) as { dir?: string | null }).dir;
    expect(dir(`cd a && cd b/c && ${CREATE} -F ../x.md`)).toBe('a/b/c');
    expect(dir(`cd /abs/repo && ${CREATE} -F x.md`)).toBe('/abs/repo');
    expect(dir(`cd a && cd /abs && cd b && ${CREATE} -F x.md`)).toBe('/abs/b');
  });

  it('does not follow a cd in a subshell, a substitution, or after another command', () => {
    const dir = (script: string) => (first(script) as { dir?: string | null }).dir;
    expect(dir(`(cd sub && ls); ${CREATE} -F b.md`)).toBeUndefined();
    expect(dir(`echo $(${CREATE} -F b.md); cd sub`)).toBeUndefined();
    expect(dir(`ls && cd sub && ${CREATE} -F b.md`)).toBeUndefined();
  });

  it('marks a cd it cannot follow as unknown', () => {
    const dir = (script: string) => (first(script) as { dir?: string | null }).dir;
    expect(dir(`cd "$DIR" && ${CREATE} -F x.md`)).toBeNull();
    expect(dir(`cd "$DIR" && cd sub && ${CREATE} -F x.md`)).toBeNull();
    expect(dir(`cd - && ${CREATE} -F x.md`)).toBeNull();
  });
});

describe('isMcpCreatePr', () => {
  it.each([
    'mcp__github__create_pull_request',
    'mcp_github_create_pull_request',
    'github-mcp-server-create_pull_request',
    'create_pull_request',
  ])('matches %s', (name) => {
    expect(isMcpCreatePr(name)).toBe(true);
  });

  it.each(['mcp__github__create_pull_request_review', 'mcp__github__get_pull_request'])(
    'does not match %s',
    (name) => {
      expect(isMcpCreatePr(name)).toBe(false);
    },
  );
});

describe('branchRefsOf', () => {
  it('strips an owner prefix from the head and tries the base, then main', () => {
    expect(
      branchRefsOf({
        kind: 'pr-create',
        fill: false,
        web: false,
        head: 'me:feat',
        base: 'dev',
        dir: 'sub',
      }),
    ).toEqual({
      head: 'feat',
      baseRefs: ['origin/dev', 'origin/main'],
      dir: 'sub',
    });
  });

  it('falls back to origin/HEAD and the working directory', () => {
    expect(branchRefsOf({ kind: 'mcp-create', body: '' })).toEqual({
      head: undefined,
      baseRefs: ['origin/HEAD', 'origin/main'],
      dir: '.',
    });
  });
});

describe('prCommandsOf', () => {
  it('reads an MCP call', () => {
    expect(prCommandsOf({ kind: 'mcp', input: { body: 'x', head: 'feat', base: 7 } })).toEqual([
      { kind: 'mcp-create', body: 'x', head: 'feat', base: undefined },
    ]);
  });

  it('reads a shell call', () => {
    expect(prCommandsOf({ kind: 'shell', command: `${CREATE} -F b.md` })).toHaveLength(1);
  });
});

describe('unfilledReviewLabels', () => {
  it('passes a filled section', () => {
    expect(unfilledReviewLabels(`## Summary\nx\n\n${filledReview()}\n\n## Notes\ny`)).toEqual([]);
  });

  it('returns null with no Review section', () => {
    expect(unfilledReviewLabels('## Summary\nx')).toBeNull();
  });

  it('names empty and missing lines', () => {
    const [firstReviewer, secondReviewer] = REVIEWERS;
    const body = [
      '## Review',
      `- **${firstReviewer.label}:** ok`,
      `- **${secondReviewer.label}:**`,
    ].join('\n');
    expect(unfilledReviewLabels(body)).toEqual(labels.slice(1));
  });

  it('ignores lines after the next heading and inside comments', () => {
    const body = [
      '## Review',
      `<!-- - **${labels[0]}:** hidden -->`,
      '## Later',
      ...labels.map((label) => `- **${label}:** too late`),
    ].join('\n');
    expect(unfilledReviewLabels(body)).toEqual(labels);
  });
});

const SKILL_DIR = '.agents/skills/review-gate/';

describe('reviewer list stays in step', () => {
  const skill = readFileSync(atRoot(`${SKILL_DIR}SKILL.md`), 'utf8');

  it('matches the PR template labels', () => {
    const template = readFileSync(atRoot('.github/pull_request_template.md'), 'utf8');
    expect(unfilledReviewLabels(template)).toEqual(labels);
    const filled = template.replace(/^(- \*\*.+:\*\*)\s*$/gm, '$1 no findings');
    expect(unfilledReviewLabels(filled)).toEqual([]);
  });

  it.each(REVIEWERS.map((reviewer) => [reviewer.agent, reviewer] as const))(
    '%s has an agent file, a skill row, and a prompt that match',
    (agent, { label }) => {
      const file = readFileSync(atRoot(`.claude/agents/${agent}.md`), 'utf8');
      const model = /^model:\s*(\S+)/m.exec(file)?.[1];
      const prompt = /`([^`]*reviewers\/[\w-]+\.md)`/.exec(file)?.[1];
      expect(model).toMatch(/^(opus|sonnet|haiku)$/);
      expect(prompt?.startsWith(SKILL_DIR)).toBe(true);
      expect(prompt && existsSync(atRoot(prompt))).toBe(true);

      const row = skill.split('\n').find((line) => line.includes(`\`${agent}\``));
      expect(row).toContain(`| ${label} `);
      expect(row).toContain(`| ${model} `);
      expect(row).toContain(prompt?.replace(SKILL_DIR, ''));
    },
  );
});

describe('hook configs stay in step with the tool table', () => {
  // Each config's matchers, tried the way Copilot does: anchored at both ends.
  const matches = (matcher: string | undefined, name: string) =>
    matcher === undefined || new RegExp(`^(?:${matcher})$`).test(name);
  const configs = [
    {
      tool: 'claude',
      file: '.claude/settings.json',
      event: 'PreToolUse',
      mcp: 'mcp__github__create_pull_request',
    },
    {
      tool: 'codex',
      file: '.codex/hooks.json',
      event: 'PreToolUse',
      mcp: 'mcp__github__create_pull_request',
    },
    {
      tool: 'gemini',
      file: '.gemini/settings.json',
      event: 'BeforeTool',
      mcp: 'mcp_github_create_pull_request',
    },
    {
      tool: 'cursor',
      file: '.cursor/hooks.json',
      event: 'beforeShellExecution',
      mcp: undefined,
    },
    {
      tool: 'copilot',
      file: '.github/hooks/review-gate.json',
      event: 'preToolUse',
      mcp: 'github-create_pull_request',
    },
  ] as const;

  it('covers every tool in the table', () => {
    expect(configs.map(({ tool }) => tool).sort()).toEqual(Object.keys(TOOLS).sort());
  });

  it.each(configs)(
    '$file routes its shell and MCP calls to --agent=$tool',
    ({ tool, file, event, mcp }) => {
      const entries: Array<{
        matcher?: string;
        command?: string;
        bash?: string;
        hooks?: Array<{ command: string }>;
      }> = JSON.parse(readFileSync(atRoot(file), 'utf8')).hooks[event];
      const commands = entries
        // Filter to review-gate entries only, so other hooks a repo adds to
        // the same file cannot break this test.
        .filter((entry) =>
          [entry.command, entry.bash, ...(entry.hooks?.map((hook) => hook.command) ?? [])]
            .filter(Boolean)
            .some((command) => command?.includes('review-gate')),
        )
        .flatMap(
          (entry) =>
            entry.hooks?.map((hook) => hook.command) ?? [entry.command ?? entry.bash ?? ''],
        );
      for (const command of commands) expect(command).toContain(`--agent=${tool}`);
      for (const name of [...TOOLS[tool].shellTools, ...(mcp ? [mcp] : [])]) {
        expect(entries.some((entry) => matches(entry.matcher, name))).toBe(true);
      }
    },
  );

  it('Claude Code routes Agent calls and every reviewer finish to the hook', () => {
    const hooks = JSON.parse(readFileSync(atRoot('.claude/settings.json'), 'utf8')).hooks;
    expect(matches(hooks.PreToolUse[0].matcher, 'Agent')).toBe(true);
    for (const agent of agents) expect(matches(hooks.SubagentStop[0].matcher, agent)).toBe(true);
  });

  it('Cursor routes MCP calls to the hook', () => {
    const hooks = JSON.parse(readFileSync(atRoot('.cursor/hooks.json'), 'utf8')).hooks;
    expect(hooks.beforeMCPExecution[0].command).toContain('--agent=cursor');
  });
});

describe('countsAsRun', () => {
  it('counts a reviewer that returned a report', () => {
    expect(countsAsRun(firstAgent, 'No findings.')).toBe(true);
  });

  it('does not count empty output or other agents', () => {
    expect(countsAsRun(firstAgent, '  ')).toBe(false);
    expect(countsAsRun(firstAgent, undefined)).toBe(false);
    expect(countsAsRun('Explore', 'report')).toBe(false);
  });
});

describe('reviewersWithoutRun', () => {
  // A line of history: base <- a <- b. `isAncestor(x, y)` is true when x
  // comes at or before y.
  const order = ['base', 'a', 'b'];
  const isAncestor = (commit: string, of: string) =>
    order.includes(commit) && order.indexOf(commit) <= order.indexOf(of);
  const onB = { head: 'b', base: 'base', isAncestor };
  const allRanOn = (head: string) => Object.fromEntries(agents.map((agent) => [agent, { head }]));

  it('counts runs on the head or an earlier branch commit', () => {
    expect(reviewersWithoutRun(allRanOn('b'), onB)).toEqual([]);
    expect(reviewersWithoutRun(allRanOn('a'), onB)).toEqual([]);
  });

  it('drops runs on a commit that is not on the branch', () => {
    expect(reviewersWithoutRun(allRanOn('gone'), onB)).toEqual(agents);
  });

  it('drops runs made before the branch had its own commits', () => {
    expect(reviewersWithoutRun(allRanOn('base'), onB)).toEqual(agents);
  });

  it('names only the reviewers that are missing', () => {
    const runs = { ...allRanOn('b'), [firstAgent]: undefined };
    expect(reviewersWithoutRun(runs, { head: 'b', base: null, isAncestor })).toEqual([firstAgent]);
  });

  it('counts nothing when the branch has no commit', () => {
    expect(reviewersWithoutRun(allRanOn('b'), { head: null, base: null, isAncestor })).toEqual(
      agents,
    );
  });
});

describe('decidePr', () => {
  const pr = {
    kind: 'pr-create',
    bodyFile: 'b.md',
    fill: false,
    web: false,
  } as const;
  const deps = { readFile: () => filledReview(), reviewersNotRun: () => [] };

  it('allows a filled body file with every reviewer run', () => {
    expect(decidePr(pr, deps)).toBeNull();
  });

  it('checks an MCP body directly', () => {
    expect(decidePr({ kind: 'mcp-create', body: filledReview() }, deps)).toBeNull();
    expect(decidePr({ kind: 'mcp-create', body: '' }, deps)?.deny).toMatch(/## Review/);
  });

  it('denies gh api creates', () => {
    expect(decidePr({ kind: 'api-create' }, deps)?.deny).toMatch(/gh api/);
  });

  it('denies a graphql file only when it creates a PR', () => {
    const files = { kind: 'graphql-files' as const, files: ['m.graphql'] };
    expect(
      decidePr(files, {
        ...deps,
        readFile: () => 'mutation { createPullRequest }',
      }),
    ).not.toBeNull();
    expect(decidePr(files, { ...deps, readFile: () => '{ viewer { login } }' })).toBeNull();
    expect(decidePr(files, { ...deps, readFile: () => null })).toBeNull();
  });

  it.each([
    ['fill', { ...pr, fill: true }],
    ['web', { ...pr, web: true }],
    ['no body file', { ...pr, bodyFile: undefined }],
    ['stdin body', { ...pr, bodyFile: '-' }],
  ])('denies %s', (_, command) => {
    expect(decidePr(command, deps)).not.toBeNull();
  });

  it('denies a relative path after a cd it cannot follow', () => {
    expect(decidePr({ ...pr, dir: null }, deps)?.deny).toMatch(/absolute path/);
    expect(decidePr({ ...pr, dir: null, bodyFile: '/abs/b.md' }, deps)).toBeNull();
    const files = {
      kind: 'graphql-files' as const,
      files: ['m.graphql'],
      dir: null,
    };
    expect(decidePr(files, deps)?.deny).toMatch(/absolute path/);
  });

  it('denies a missing body file', () => {
    expect(decidePr(pr, { ...deps, readFile: () => null })?.deny).toMatch(/does not exist/);
  });

  it('denies when reviewers have not run, naming them', () => {
    expect(decidePr(pr, { ...deps, reviewersNotRun: () => [firstAgent] })?.deny).toContain(
      firstAgent,
    );
  });

  it('adds the Review format only to Review-section denials', () => {
    expect(decidePr({ ...pr, web: true }, deps)?.deny).not.toMatch(/## Review/);
    expect(decidePr(pr, { ...deps, readFile: () => 'no section' })?.deny).toMatch(/## Review/);
  });
});

describe('decideReviewerStart', () => {
  it('denies a reviewer with a model override', () => {
    expect(decideReviewerStart({ subagent_type: firstAgent, model: 'fable' })?.deny).toMatch(
      /without a `model`/,
    );
  });

  it('allows a reviewer with no model, and other agents with one', () => {
    expect(decideReviewerStart({ subagent_type: firstAgent })).toBeNull();
    expect(decideReviewerStart({ subagent_type: 'Explore', model: 'haiku' })).toBeNull();
  });
});
