// @ts-check
// Rules for the pre-PR review gate. See docs/agents/git-and-prs.md.
// No I/O: the entry script (review-gate.mjs) reads files and git and passes
// the results in, so every rule here is unit-tested.

import { flagSet, readApiCall, readGhFlags, urlPath } from './gh-flags.mjs';
import { GH_VALUE_FLAGS, ghCommand, placeCommands, wordsOf } from './shell-parse.mjs';

/** @typedef {import('./shell-parse.mjs').Word} Word */

/** The reviewers, in the order the PR template lists them. */
export const REVIEWERS = /** @type {const} */ ([
  { agent: 'review-code-quality', label: 'Code quality' },
  { agent: 'review-correctness', label: 'Correctness' },
  { agent: 'review-spec', label: 'Spec, security, copy' },
  { agent: 'review-dry', label: 'DRY' },
]);

/** @typedef {(typeof REVIEWERS)[number]['agent']} ReviewerAgent */

/**
 * The AI tools the hook supports, keyed by the `--agent` value each tool's
 * hook config passes. `shellTools` are the tool names that run shell
 * commands. Only Claude Code runs the reviewer agents, so only it tracks
 * reviewer runs. A test checks every hook config against this table.
 */
export const TOOLS = /** @type {const} */ ({
  claude: { shellTools: ['Bash'], tracksReviewers: true },
  codex: { shellTools: ['Bash'], tracksReviewers: false },
  gemini: { shellTools: ['run_shell_command'], tracksReviewers: false },
  cursor: { shellTools: [], tracksReviewers: false },
  copilot: { shellTools: ['bash'], tracksReviewers: false },
});

/**
 * Whether an MCP tool name is a create-PR tool, such as
 * `mcp__github__create_pull_request`. `create_pull_request_review` is not.
 * @param {string} name
 */
export function isMcpCreatePr(name) {
  return /(^|[_-])create_pull_request$/i.test(name);
}

/**
 * A call that opens a PR. `dir` is the folder the command runs in, from
 * `placeCommands`, relative to the hook's working directory (`.` when no `cd`
 * moved it), or null when it cannot tell, such as after `cd "$DIR"`.
 * @typedef {{ kind: 'pr-create', bodyFile?: string, fill: boolean, web: boolean, head?: string, base?: string, dir?: string | null }
 *   | { kind: 'mcp-create', body: string, head?: string, base?: string }
 *   | { kind: 'api-create' }
 *   | { kind: 'unread', word: string }
 *   | { kind: 'graphql-files', files: string[], dir?: string | null }} PrCommand
 */

/**
 * A tool call, as an adapter in review-gate.mjs reads it.
 * @typedef {{ kind: 'shell', command: string }
 *   | { kind: 'mcp', input: Record<string, unknown> }} PrCall
 */

/** @typedef {{ deny: string } | null} Decision */

// ---- gh commands ----

const PR_CREATE_VALUE_FLAGS = new Set([
  ...flagSet(
    'title body body-file base head assignee label milestone project reviewer template recover',
    ['-t', '-b', '-F', '-B', '-H', '-a', '-l', '-m', '-p', '-r', '-T'],
  ),
  ...GH_VALUE_FLAGS,
]);

/**
 * @param {Word[]} args  the words after `gh pr create`
 * @param {string | null | undefined} dir
 * @returns {PrCommand | null}
 */
function classifyPrCreate(args, dir) {
  const { values, has, maybe, help } = readGhFlags(args, PR_CREATE_VALUE_FLAGS);
  // Help and dry run skip the gate only when surely set; fill and web are
  // refused when they may be set. One call per flag: see `readGhFlags`.
  if (help || has('--dry-run')) return null;
  const last = (/** @type {string[]} */ ...aliases) => values(...aliases).at(-1)?.text;
  return {
    kind: 'pr-create',
    bodyFile: last('-F', '--body-file'),
    fill: maybe('-f', '--fill') || maybe('--fill-first') || maybe('--fill-verbose'),
    web: maybe('-w', '--web'),
    head: last('-H', '--head'),
    base: last('-B', '--base'),
    dir,
  };
}

// The endpoint that lists and opens PRs, as `urlPath` writes it. GitHub
// Enterprise serves the API under `/api/v3`.
const PULLS_ENDPOINT = /^(\/api\/v3)?\/repos\/[^/]+\/[^/]+\/pulls$/;

/**
 * @param {Word[]} args  the words after `gh api`
 * @param {string | null | undefined} dir
 * @returns {PrCommand | null}
 */
function classifyApi(args, dir) {
  const { endpoint, fields, inputs, method } = readApiCall(args);
  const texts = fields.map(({ text }) => text);

  if (endpoint?.text === 'graphql') {
    if (texts.some((field) => field.includes('createPullRequest'))) return { kind: 'api-create' };
    const files = [
      ...texts.flatMap((field) => /^[^=]+=@(.+)$/.exec(field)?.[1] ?? []),
      ...inputs.map(({ text }) => text),
    ];
    return files.length > 0 ? { kind: 'graphql-files', files, dir } : null;
  }
  const opens = endpoint && PULLS_ENDPOINT.test(urlPath(endpoint.text)) && method.text === 'POST';
  return opens ? { kind: 'api-create' } : null;
}

/**
 * The PR-opening commands in a shell script, if any. `dir` is the folder
 * each one runs in, from {@link placeCommands}, relative to the hook's
 * working directory.
 * @param {string} script
 * @returns {PrCommand[]}
 */
export function findPrCommands(script) {
  /** @type {PrCommand[]} */
  const found = [];
  for (const { command, folder: dir } of placeCommands(script, '.')) {
    const gh = ghCommand(wordsOf(command), ({ text }) => text);
    if (!gh) continue;
    // A word built at run time where gh reads its command or the pr
    // subcommand may become `pr create`.
    const unread = [gh.group, gh.group.text === 'pr' ? gh.sub : undefined].find(
      (word) => word?.dynamic,
    );
    if (unread) {
      found.push({ kind: 'unread', word: unread.text });
    } else if (gh.group.text === 'pr' && (gh.sub?.text === 'create' || gh.sub?.text === 'new')) {
      const pr = classifyPrCreate(gh.subArgs, dir);
      if (pr) found.push(pr);
    } else if (gh.group.text === 'api') {
      const api = classifyApi(gh.rest, dir);
      if (api) found.push(api);
    }
  }
  return found;
}

/**
 * The PR-opening commands in a tool call.
 * @param {PrCall} call
 * @returns {PrCommand[]}
 */
export function prCommandsOf(call) {
  if (call.kind === 'shell') return findPrCommands(call.command);
  const text = (/** @type {unknown} */ value) => (typeof value === 'string' ? value : undefined);
  return [
    {
      kind: 'mcp-create',
      body: text(call.input.body) ?? '',
      head: text(call.input.head),
      base: text(call.input.base),
    },
  ];
}

// ---- Review section ----

/**
 * The reviewer labels whose `**Label:**` line under `## Review` is missing
 * or empty. Null when the body has no `## Review` section at all.
 * @param {string} markdown
 * @returns {string[] | null}
 */
export function unfilledReviewLabels(markdown) {
  const lines = markdown
    .replace(/\r/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n');
  const start = lines.findIndex((line) => /^##\s+Review\s*$/.test(line.trim()));
  if (start === -1) return null;
  const end = lines.findIndex((line, i) => i > start && /^##\s/.test(line.trim()));
  const section = lines.slice(start + 1, end === -1 ? undefined : end);

  return REVIEWERS.filter(({ label }) => {
    const prefix = `**${label}:**`;
    const line = section.find((candidate) => candidate.includes(prefix));
    return !line || line.slice(line.indexOf(prefix) + prefix.length).trim() === '';
  }).map(({ label }) => label);
}

// ---- Reviewer runs ----

/**
 * The refs to check reviewer runs against: the PR's head branch (without an
 * `owner:` prefix), the base refs to try in order, and the directory to run
 * git in.
 * @param {PrCommand} pr
 * @returns {{ head?: string, baseRefs: string[], dir: string | null }}
 */
export function branchRefsOf(pr) {
  if (pr.kind === 'api-create' || pr.kind === 'graphql-files' || pr.kind === 'unread') {
    return {
      baseRefs: [],
      dir: pr.kind === 'graphql-files' ? (pr.dir ?? '.') : '.',
    };
  }
  return {
    head: pr.head?.replace(/^[^:]+:/, ''),
    baseRefs: [`origin/${pr.base ?? 'HEAD'}`, 'origin/main'],
    dir: pr.kind === 'pr-create' ? (pr.dir ?? '.') : '.',
  };
}

/**
 * The report a background subagent handed back in its last turn: the
 * `message` of the last accepted `SubagentHandback` call in its transcript
 * (JSON lines). A background subagent ends with that call instead of a text
 * message, so its `last_assistant_message` is empty.
 *
 * A resumed subagent keeps one transcript across turns, so a new prompt
 * clears the report: a handback from an earlier turn never counts for this
 * one. A handback the runtime rejected (`"success":false`) does not count.
 * @param {string} transcript
 * @returns {string | undefined}
 */
export function handbackReport(transcript) {
  /** @type {string | undefined} */
  let report;
  /** @type {{ id: unknown, before: string | undefined } | undefined} */
  let last;
  for (const line of transcript.split('\n')) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry?.message?.content;
    if (entry?.type === 'user') {
      if (isPrompt(content)) report = last = undefined;
      for (const block of Array.isArray(content) ? content : []) {
        const isLastResult = block?.type === 'tool_result' && block.tool_use_id === last?.id;
        if (isLastResult && textOf(block.content).includes('"success":false')) {
          report = last?.before;
        }
      }
    } else if (entry?.type === 'assistant' && Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'tool_use' && block.name === 'SubagentHandback') {
          const message = block.input?.message;
          last = { id: block.id, before: report };
          report = typeof message === 'string' ? message : undefined;
        }
      }
    }
  }
  return report;
}

/**
 * Whether a user transcript line is a new prompt, not only tool results.
 * @param {unknown} content
 */
function isPrompt(content) {
  if (typeof content === 'string') return true;
  return Array.isArray(content) && content.some((block) => block?.type === 'text');
}

/**
 * The text of a tool result's content: a string, or a list of text blocks.
 * @param {unknown} content
 */
function textOf(content) {
  if (typeof content === 'string') return content;
  return Array.isArray(content) ? content.map((block) => block?.text ?? '').join('') : '';
}

/**
 * @param {unknown} agent
 * @returns {agent is ReviewerAgent}
 */
export function isReviewer(agent) {
  return REVIEWERS.some((reviewer) => reviewer.agent === agent);
}

/**
 * Whether a subagent's output is a report: a string that is not blank.
 * @param {unknown} output
 * @returns {output is string}
 */
export function isReport(output) {
  return typeof output === 'string' && output.trim() !== '';
}

/**
 * Whether a finished subagent counts as a reviewer run: it is a reviewer,
 * and it returned a report.
 * @param {unknown} agent
 * @param {unknown} output
 * @returns {agent is ReviewerAgent}
 */
export function countsAsRun(agent, output) {
  return isReviewer(agent) && isReport(output);
}

/**
 * The reviewers with no run that counts for this PR. A run counts when the
 * commit it reviewed is on the PR branch and not already on the base. Fix
 * commits made after the review still count; amending, squashing, or
 * rebasing past the reviewed commit does not.
 * @param {Partial<Record<ReviewerAgent, { head?: string }>>} runs
 * @param {{ head: string | null, base: string | null, isAncestor: (commit: string, of: string) => boolean }} branch
 * @returns {ReviewerAgent[]}
 */
export function reviewersWithoutRun(runs, { head, base, isAncestor }) {
  return REVIEWERS.map(({ agent }) => agent).filter((agent) => {
    const reviewed = runs[agent]?.head;
    if (!head || !reviewed) return true;
    const onBranch = isAncestor(reviewed, head);
    const onlyBase = base !== null && isAncestor(reviewed, base);
    return !onBranch || onlyBase;
  });
}

// ---- Decisions ----

const REVIEW_FORMAT =
  'The PR body needs a "## Review" section with one filled line per reviewer, as in .github/pull_request_template.md.';

/**
 * Decides a PR-opening command. `readFile` resolves paths from the PR
 * command's directory and returns null for a missing file. Tools that do
 * not track reviewer runs pass `reviewersNotRun: () => []`.
 * @param {PrCommand} pr
 * @param {{ readFile: (path: string) => string | null, reviewersNotRun: () => ReviewerAgent[] }} deps
 * @returns {Decision}
 */
export function decidePr(pr, { readFile, reviewersNotRun }) {
  if (pr.kind === 'unread') {
    return {
      deny: `The hook cannot read \`${pr.word}\` in this gh command: the shell builds it at run time, and it may become \`pr create\`. Write the gh command and its subcommand out in full.`,
    };
  }
  if (pr.kind === 'api-create') {
    return { deny: 'Open PRs with `gh pr create --body-file`, not `gh api`.' };
  }
  const relative = (/** @type {string} */ path) => !path.startsWith('/');
  const unknownDir =
    'The hook cannot tell which directory a `cd` moved to. Pass an absolute path, or drop the `cd`.';
  if (pr.kind === 'graphql-files') {
    if (pr.dir === null && pr.files.some(relative)) return { deny: unknownDir };
    const creates = pr.files.some((file) => readFile(file)?.includes('createPullRequest'));
    return creates
      ? {
          deny: 'Open PRs with `gh pr create --body-file`, not a GraphQL mutation.',
        }
      : null;
  }

  let body;
  if (pr.kind === 'mcp-create') {
    body = pr.body;
  } else if (pr.fill || pr.web) {
    return {
      deny: 'The hook cannot read a body from `--fill` or `--web`. Use `--body-file`.',
    };
  } else if (!pr.bodyFile || pr.bodyFile === '-') {
    return {
      deny: 'Write the PR body to a file first, in its own step. Then run `gh pr create --body-file <path>`.',
    };
  } else if (pr.dir === null && relative(pr.bodyFile)) {
    return { deny: unknownDir };
  } else {
    body = readFile(pr.bodyFile);
    if (body === null) {
      return {
        deny: `The body file \`${pr.bodyFile}\` does not exist. Write it in its own step before \`gh pr create\`.`,
      };
    }
  }

  const notRun = reviewersNotRun();
  if (notRun.length > 0) {
    return {
      deny: `These reviewers have no run on this branch: ${notRun.join(', ')}. Start each with the Agent tool, subagent_type set to its name and no model.`,
    };
  }

  const unfilled = unfilledReviewLabels(body);
  if (unfilled === null) {
    return { deny: `The PR body has no "## Review" section. ${REVIEW_FORMAT}` };
  }
  if (unfilled.length > 0) {
    return {
      deny: `The Review section has no filled line for: ${unfilled.join(', ')}. ${REVIEW_FORMAT}`,
    };
  }
  return null;
}

/**
 * Decides a Claude Code Agent-tool call that starts a subagent.
 * @param {{ subagent_type?: unknown, model?: unknown }} input
 * @returns {Decision}
 */
export function decideReviewerStart(input) {
  const reviewer = REVIEWERS.find(({ agent }) => agent === input.subagent_type);
  if (!reviewer || !input.model) return null;
  return {
    deny: `Start ${reviewer.agent} without a \`model\` parameter. Its model is pinned in .claude/agents/${reviewer.agent}.md.`,
  };
}
