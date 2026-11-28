// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  REVIEWERS,
  TOOLS,
  branchRefsOf,
  countsAsRun,
  decidePr,
  decideReviewerStart,
  findPrCommands,
  handbackReport,
  isMcpCreatePr,
  prCommandsOf,
  reviewersWithoutRun,
  unfilledReviewLabels,
} from './review-gate-policy.mjs';
import {
  CREATE,
  GH,
  filledReview,
  handbackLine,
  handbackResultLine,
  promptLine,
} from './review-gate-fixtures';
import {
  NESTED_GLOB_NAMES,
  atRoot,
  nestedGlob,
  nestedSubstitutionGlobs,
} from './shell-parse-fixtures';

const kinds = (script: string) => findPrCommands(script).map((pr) => pr.kind);
// A glob qualifier group whose e string opens a PR (#465).
const E_CREATE = `(e:'${CREATE} -F b.md':)`;
const first = (script: string) => findPrCommands(script)[0];
const labels = REVIEWERS.map(({ label }) => label);
const agents = REVIEWERS.map(({ agent }) => agent);
const firstAgent = REVIEWERS[0].agent;

const dir = (script: string) => (first(script) as { dir?: string | null }).dir;

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
    ['in a time( subshell', `time(${CREATE} -F b.md)`],
    ['in a time( subshell after &&', `true && time(${CREATE} -F b.md)`],
    ['in a coproc( subshell', `coproc(${CREATE} -F b.md)`],
    ['in a time( subshell in bash -c', `bash -c 'time(${CREATE} -F b.md)'`],
    ['in a f( ) function in a substitution', `echo $(f( ) { ${CREATE} -F b.md; }; f)`],
    ['in a select( subshell', `select(${CREATE} -F b.md)`],
    ['in a time -p( subshell', `time -p(${CREATE} -F b.md)`],
    ['in a ! time -p( subshell', `! time -p(${CREATE} -F b.md)`],
    ['in a time -p( subshell in a substitution', `echo $(time -p(${CREATE} -F b.md))`],
    ['in a case pattern glued to in(', `case x in(x) ${CREATE} -F b.md;; esac`],
    ['in a coproc name( subshell', `coproc foo(${CREATE} -F b.md)`],
    ['in a coproc NAME { } group', `coproc foo { ${CREATE} -F b.md; }`],
    ['in a coproc NAME ( ) subshell', `coproc foo ( ${CREATE} -F b.md )`],
    ['in a coproc { } group', `coproc { ${CREATE} -F b.md; }`],
    ['in a coproc NAME while loop', `coproc foo while true; do ${CREATE} -F b.md; done`],
    ['as a coproc simple command', `coproc ${CREATE} -F b.md`],
    ['as a coproc simple command after &&', `true && coproc ${CREATE} -F b.md`],
    ['in a ( glued to an argument', `x a(${CREATE} -F b.md)`],
    ['in a ( standing alone as an argument', `x (${CREATE} -F b.md)`],
    ['in a case pattern with a leading (', `case x in (a) ${CREATE} -F b.md;; esac`],
    ['in a glob qualifier’s e string', `ls *(e:"${CREATE} -t x -b y":)`],
    ['in a glob qualifier’s e[ ] string', `ls *(e['${CREATE} -F b.md'])`],
    ['in a glob qualifier’s sort e string', `ls *(oe:'${CREATE} -F b.md':)`],
    ['in an e string after a glob group', `ls (a|b)${E_CREATE}`],
    ['in an e string in a repeat subshell', `repeat 1 (ls *${E_CREATE})`],
    ['in an e string in a coproc subshell', `coproc (ls *${E_CREATE})`],
    ['in an e string in a for list', `for f (*${E_CREATE}) :`],
    ['in an e string in a foreach list', `foreach f (*${E_CREATE}) :; end`],
    ['in an e string in a select list', `select f (*${E_CREATE}) :`],
    ['in an e string in a two-name for list', `for f g (*${E_CREATE}) :`],
    // A list or subshell whose first word reads as an e string still runs
    // the glob group in it.
    ['after an e-like word in a for list', `for f (e:true: *${E_CREATE}) echo`],
    ['after an e glob in a for list', `for f (e*.txt x/*${E_CREATE}) echo`],
    ['after an e-like word in a foreach list', `foreach f (e:true: *${E_CREATE}) echo; end`],
    ['after an e-like word in a select list', `select f (e:true: *${E_CREATE}) echo`],
    ['after an e-like command in a repeat subshell', `repeat 1 (e:true:; ls *${E_CREATE})`],
    ['after an e-like command in a coproc subshell', `coproc (e:true:; ls *${E_CREATE})`],
    ['in a glob group at a word start in a for list', `for f ( (a)(e:${GH}\\ pr\\ create:) ) echo`],
    ['after many cheap glob groups', `ls ${'x(+a)'.repeat(500)} *${E_CREATE}`],
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
      dir: '.',
    });
    expect(first(`cd sub && ${GH} api graphql --input m.json`)).toMatchObject({
      files: ['m.json'],
      dir: 'sub',
    });
  });
});

// The two gate checks once read gh flags with two readers that disagreed on
// these forms. Each now reads them as gh does.
describe('findPrCommands: reads flags as gh does', () => {
  it.each([
    ['glued -X=POST', `${GH} api -X=POST repos/o/r/pulls`],
    ['endpoint with ..', `${GH} api -X POST repos/o/r/pulls/x/..`],
    ['%-encoded endpoint', `${GH} api -X POST repos/o/r/%70ulls`],
    ['endpoint with a fragment', `${GH} api -X POST 'repos/o/r/pulls#x'`],
  ])('gh api: %s', (_, script) => {
    expect(kinds(script)).toEqual(['api-create']);
  });

  it.each([
    ['dry run set to f', `${CREATE} --dry-run=f -F b.md`],
    ['dry run built at run time', `${CREATE} --dry-run="$X" -F b.md`],
    ['help set to f', `${CREATE} --help=f -F b.md`],
    ['short help built at run time', `${CREATE} -h"$X" -F b.md`],
    ['short help with a filename pattern', `${CREATE} -h* -F b.md`],
  ])('gates a create that is not a dry run or help: %s', (_, script) => {
    expect(kinds(script)).toEqual(['pr-create']);
  });

  it.each([
    ['glued -F=', `${CREATE} -F=b.md`, { bodyFile: 'b.md' }],
    ['last body file wins', `${CREATE} --body-file a.md -F b.md`, { bodyFile: 'b.md' }],
    ['=false on a short flag', `${CREATE} -F b.md -w=false`, { web: false, fill: false }],
    ['web built at run time', `${CREATE} -F b.md --web="$X"`, { web: true }],
    ['fill built at run time', `${CREATE} -F b.md --fill="$X"`, { fill: true }],
    ['web with a filename pattern', `${CREATE} -F b.md --web=t*`, { web: true }],
    ['fill with a filename pattern', `${CREATE} -F b.md --fill=[t]`, { fill: true }],
    ['quoted fill pattern', `${CREATE} -F b.md --fill='t*'`, { fill: false }],
  ])('reads %s', (_, script, read) => {
    expect(first(script)).toMatchObject(read);
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
    expect(dir(`cd a && cd b/c && ${CREATE} -F ../x.md`)).toBe('a/b/c');
    expect(dir(`cd /abs/repo && ${CREATE} -F x.md`)).toBe('/abs/repo');
    expect(dir(`cd a && cd /abs && cd b && ${CREATE} -F x.md`)).toBe('/abs/b');
    // A group and a background list keep the cd that leads them.
    expect(dir(`{ cd sub; ${CREATE} -F x.md; }`)).toBe('sub');
    expect(dir(`X=1; cd sub && ${CREATE} -F x.md`)).toBe('sub');
    expect(dir(`cd sub && ${CREATE} -F x.md &`)).toBe('sub');
    expect(dir(`cd a && (${CREATE} -F x.md)`)).toBe('a');
    // A pipeline runs in subshells, so it does not end the leading run of cds.
    expect(dir(`ls | cat; cd sub && ${CREATE} -F x.md`)).toBe('sub');
  });

  it.each([
    [`cd ../wtA && coproc { cd /tmp; }; ${CREATE} --body-file b.md`, '../wtA'],
    [`cd ../wtA && coproc foo { cd /tmp; }; ${CREATE} --body-file b.md`, '../wtA'],
    [`cd ../wtA && coproc cd /tmp; ${CREATE} --body-file b.md`, '../wtA'],
    [`cd ../wtA && coproc foo { ${CREATE} --body-file b.md; }`, '../wtA'],
    [`coproc { cd sub; ${CREATE} --body-file b.md; }`, 'sub'],
  ])('keeps a cd inside a coproc to the coprocess: %s', (script, expected) => {
    expect(dir(script)).toBe(expected);
  });

  it('does not follow a cd in a subshell, a substitution, a pipe, or a background job', () => {
    expect(dir(`(cd sub && ls); ${CREATE} -F b.md`)).toBe('.');
    expect(dir(`echo $(${CREATE} -F b.md); cd sub`)).toBe('.');
    expect(dir(`cd sub | cat; ${CREATE} -F b.md`)).toBe('.');
    expect(dir(`cd sub & ${CREATE} -F b.md`)).toBe('.');
    expect(dir(`cd sub && ls & ${CREATE} -F b.md`)).toBe('.');
  });

  it('follows a cd that comes after another command, as the guard does', () => {
    expect(dir(`ls && cd sub && ${CREATE} -F b.md`)).toBe('sub');
    // A cd inside a compound body may or may not have run.
    expect(dir(`{ cd sub; }; ${CREATE} -F b.md`)).toBeNull();
  });

  // zsh runs a glob qualifier's e string once per file matched, so a cd in
  // it may or may not run (#465).
  it('cannot tell the folder after a cd in a glob qualifier’s e string', () => {
    expect(dir(`ls *(e:'cd sub':); ${CREATE} -F b.md`)).toBeNull();
  });

  // Deeply nested glob groups do not stop the parser (#465).
  it.each(NESTED_GLOB_NAMES)('finds a PR open before a deeply nested glob group: %s', (form) => {
    expect(kinds(`${CREATE} -F b.md; ${nestedGlob(form)}`)).toEqual(['pr-create']);
  });

  // Main took seconds on this shape: placing each command was quadratic.
  it('finds PR commands in nested glob groups with a $(...) in a time budget', () => {
    const start = performance.now();
    findPrCommands(nestedSubstitutionGlobs(1000));
    expect(performance.now() - start).toBeLessThan(5000);
  });

  it('reads every cd form the guard reads, the same way', () => {
    expect(dir(`cd sub && ${CREATE} -F b.md`)).toBe('sub');
    expect(dir(`cd "my dir" && ${CREATE} -F b.md`)).toBe('my dir');
    expect(dir(`cd -P sub && ${CREATE} -F b.md`)).toBe('sub');
    expect(dir(`cd -- sub && ${CREATE} -F b.md`)).toBe('sub');
    expect(dir(`cd /abs/x && ${CREATE} -F b.md`)).toBe('/abs/x');
    expect(dir(`cd ../up && ${CREATE} -F b.md`)).toBe('../up');
    expect(dir(`cd && ${CREATE} -F b.md`)).toBeNull();
    expect(dir(`cd - && ${CREATE} -F b.md`)).toBeNull();
    expect(dir(`cd ~/x && ${CREATE} -F b.md`)).toBeNull();
    expect(dir(`pushd sub && ${CREATE} -F b.md`)).toBe('sub');
  });

  it('marks a cd it cannot follow as unknown', () => {
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

  it('keeps an unknown folder unknown, not the working directory', () => {
    expect(branchRefsOf({ kind: 'pr-create', fill: false, web: false, dir: null }).dir).toBeNull();
    const files = { kind: 'graphql-files' as const, files: [], dir: null };
    expect(branchRefsOf(files).dir).toBeNull();
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
      // Filter to review-gate entries only, so other hooks a repo adds to
      // the same file cannot break this test.
      const gateEntries = entries.filter((entry) =>
        [entry.command, entry.bash, ...(entry.hooks?.map((hook) => hook.command) ?? [])]
          .filter(Boolean)
          .some((command) => command?.includes('review-gate')),
      );
      expect(gateEntries.length).toBeGreaterThan(0);
      const commands = gateEntries.flatMap(
        (entry) => entry.hooks?.map((hook) => hook.command) ?? [entry.command ?? entry.bash ?? ''],
      );
      for (const command of commands) expect(command).toContain(`--agent=${tool}`);
      for (const name of [...TOOLS[tool].shellTools, ...(mcp ? [mcp] : [])]) {
        expect(gateEntries.some((entry) => matches(entry.matcher, name))).toBe(true);
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

describe('handbackReport', () => {
  it('reads the report from the last SubagentHandback call', () => {
    const transcript = [handbackLine('first'), '{"type":"user"}', 'not json', handbackLine('last')];
    expect(handbackReport(transcript.join('\n'))).toBe('last');
  });

  it('returns undefined when the subagent never handed back', () => {
    expect(handbackReport('{"type":"user"}\n')).toBeUndefined();
    expect(handbackReport('')).toBeUndefined();
  });

  it('ignores a handback from an earlier turn of a resumed subagent', () => {
    const transcript = [handbackLine('old'), promptLine('Check again.')];
    expect(handbackReport(transcript.join('\n'))).toBeUndefined();
    transcript.push(handbackLine('new', 'toolu_2'));
    expect(handbackReport(transcript.join('\n'))).toBe('new');
  });

  it('ignores a handback the runtime rejected', () => {
    const delivered = [handbackLine('sent', 'toolu_1'), handbackResultLine('toolu_1', true)];
    const rejected = [handbackLine('again', 'toolu_2'), handbackResultLine('toolu_2', false)];
    expect(handbackReport([...delivered, ...rejected].join('\n'))).toBe('sent');
    expect(handbackReport([promptLine('Go.'), ...rejected].join('\n'))).toBeUndefined();
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
  // The first PR command in a script, and the decision on it.
  const decideScript = (script: string, using = deps) => {
    const command = first(script);
    if (command === undefined) throw new Error(`no PR command in ${script}`);
    return { command, decision: decidePr(command, using) };
  };

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

  // #472: the reviewer runs are read from the PR's folder too, so an absolute
  // body path is not enough.
  it.each([
    ['a relative body path', { ...pr, dir: null }],
    ['an absolute body path', { ...pr, dir: null, bodyFile: '/abs/b.md' }],
  ])('denies a pr create in a folder it cannot tell, with %s', (_, command) => {
    expect(decidePr(command, deps)?.deny).toMatch(/cannot tell which folder/);
  });

  it.each([
    ['no cd', `${CREATE} --body-file b.md`, '.'],
    ['a cd it follows', `cd ../wtA && ${CREATE} --body-file b.md`, '../wtA'],
    [
      'a cd in a subshell before it',
      `cd ../wtA && (cd /tmp); ${CREATE} --body-file b.md`,
      '../wtA',
    ],
    // A `case` body ends before the `)` that closes its substitution.
    [
      'a cd in a case in a substitution before it',
      `x=$(case a in a) cd /tmp;; esac); ${CREATE} --body-file b.md`,
      '.',
    ],
    // A `;` inside the group does not keep its cd out of the background job.
    [
      'a cd in a group sent to the background',
      `(cd /other; ${CREATE} --body-file b.md) & wait`,
      '/other',
    ],
  ])('lets a pr create through with %s', (_, script, folder) => {
    const { command, decision } = decideScript(script);
    expect(command).toMatchObject({ dir: folder });
    expect(decision).toBeNull();
  });

  it.each([
    `cd ../wtA && { cd /tmp; }; ${CREATE} --body-file b.md`,
    `cd ../wtA && { cd /tmp; }; ${CREATE} --body-file /abs/b.md`,
    `{ coproc foo { true; }; cd /tmp; }; cd /abs && ${CREATE} --body-file b.md`,
    `cd "$DIR" && ${CREATE} --body-file /abs/b.md`,
  ])('denies a pr create whose folder it cannot tell: %s', (script) => {
    const { command, decision } = decideScript(script);
    expect(command).toMatchObject({ dir: null });
    expect(decision?.deny).toMatch(/cannot tell which folder/);
  });

  it('denies a relative graphql file after a cd it cannot follow', () => {
    const files = {
      kind: 'graphql-files' as const,
      files: ['m.graphql'],
      dir: null,
    };
    expect(decidePr(files, deps)?.deny).toMatch(/absolute path/);
  });

  // The shell does not expand `~` after `=@` or in quotes, so gh reads a `~`
  // file from the folder the command runs in, which the hook cannot tell.
  it.each([
    [`${GH} api graphql -F query=@/abs/q.graphql`, /GraphQL mutation/, ['/abs/q.graphql']],
    [`${GH} api graphql -F query=@~/q.graphql`, /cannot tell which folder/, []],
    [`${GH} api graphql --input "~/q.json"`, /cannot tell which folder/, []],
    [`${GH} api graphql -F query=@~`, /cannot tell which folder/, []],
  ])('after a cd it cannot follow, decides %s', (call, expected, reads) => {
    const read: string[] = [];
    const readFile = (path: string) => {
      read.push(path);
      return 'mutation { createPullRequest }';
    };
    const { decision } = decideScript(`cd "$X" && ${call}`, { ...deps, readFile });
    expect(decision?.deny).toMatch(expected);
    expect(read).toEqual(reads);
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
