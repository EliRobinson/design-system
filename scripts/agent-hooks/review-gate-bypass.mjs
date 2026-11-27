// @ts-check
// Merges that bypass branch protection, which the review gate always
// refuses, whatever the PR's Review section says. See
// docs/agents/git-and-prs.md#merges-that-bypass-branch-protection.
// No I/O, like review-gate-policy.mjs.

import { posix } from 'node:path';

import { flagSet, readApiCall, readGhFlags, urlPath } from './gh-flags.mjs';
import { GH_VALUE_FLAGS, SHELLS, parseCommands, shellScriptOf, wordsOf } from './shell-parse.mjs';

/** @typedef {import('./shell-parse.mjs').Command} Command */
/** @typedef {import('./shell-parse.mjs').Word} Word */

const ASK_ELI =
  'Never bypass branch protection. If a plain `gh pr merge` is refused because a check fails or a branch rule blocks it, stop and ask Eli in chat, and say what blocks it. Do not look for another way around it.';
const NOT_CLEARED =
  'A Review section does not clear this, and neither does writing the bypass another way.';

export const ADMIN_REASON = `\`gh pr merge --admin\` (even \`--admin=false\`) merges past required checks and branch rules. Remove \`--admin\`. ${ASK_ELI} ${NOT_CLEARED}`;
export const REST_MERGE_REASON = `A merge through the REST API (\`pulls/<N>/merge\`) skips the branch protection check that \`gh pr merge\` makes, so with admin rights it is the same bypass as \`--admin\`. Use a plain \`gh pr merge\`. ${ASK_ELI} ${NOT_CLEARED}`;
const THROUGH_ANOTHER_PROGRAM = ' Run gh directly, not through another program.';
const FLAGS_FIRST_REASON =
  'The hook cannot tell which gh command this is when flags come before the subcommand. Write `gh pr ...` or `gh api ...` with the subcommand first and the flags after it.';
const ACTION_FIRST_REASON =
  'The hook cannot tell where the gh pr action is when a flag other than `-R` comes before it. Write the action right after `gh pr`, then the flags.';

// Why a word the hook cannot read is refused, by where it stands. A word in
// gh's command or pr action position, or a flag before one, may become a
// whole command; a word after `gh pr merge` or `gh api` may become a flag.
// A run-time endpoint of a gh api write may become `repos/<o>/<r>/pulls` or
// `pulls/<N>/merge`, wherever in it the run-time part stands.
const COMMAND_CLAUSE =
  'it may become `gh pr create` or `gh pr merge --admin`. Write the gh command, the pr action and any flag that comes before them out in full';
const FLAG_CLAUSE =
  'it may become a flag such as `--admin` or `-X PUT`. Write the PR number, the endpoint and every flag out in full';
const UNREAD_AT = {
  ghCommand: `in this gh command: the shell builds it at run time, and ${COMMAND_CLAUSE}`,
  prAction: `in this gh pr command: the shell builds it at run time, and ${COMMAND_CLAUSE}`,
  prMerge: `in this gh pr merge: the shell builds it at run time, and ${FLAG_CLAUSE}`,
  apiCall: `in this gh api call: the shell builds it at run time, and ${FLAG_CLAUSE}`,
  apiWrite:
    "in this gh api write's endpoint: the shell builds it at run time, and it may become a PR open or a PR merge. Write the endpoint out in full",
};

/**
 * @param {keyof typeof UNREAD_AT} position
 * @param {Word} word
 * @param {boolean} [isValue]  whether the word is a flag's value, which
 *   double quotes stop from splitting
 */
function unreadReason(position, word, isValue = false) {
  const quote =
    isValue && word.splits === 'unquoted' ? ', and put a flag value in double quotes' : '';
  return `The hook cannot read \`${word.text}\` ${UNREAD_AT[position]}${quote}.`;
}

/**
 * Reads the flag at `args[i]`, which starts with `-`, before gh's command or
 * the pr action.
 * - `width`: the words it takes, 2 for `-R <value>` and `--repo <value>`.
 * - `repo`: whether it is `-R` or `--repo`, spaced or glued (`-Ro/r`,
 *   `--repo=o/r`). Its value is known, so it never takes the next word.
 * - `unread`: what the hook cannot read: a `-R`/`--repo` value the shell
 *   splits (`-R $X` with `X='o/r pr'` makes the command `pr`), or any other
 *   flag built at run time (`-$X`), which may split or take the next word.
 *   A glued value that does not split (`-R"$R"`) is only a value.
 * @param {Word[]} args
 * @param {number} i
 * @returns {{ width: 1 | 2, repo: boolean, unread?: { word: Word, isValue: boolean } }}
 */
function readLeadingFlag(args, i) {
  const word = /** @type {Word} */ (args[i]);
  if (GH_VALUE_FLAGS.has(word.text)) {
    const value = args[i + 1];
    return {
      width: 2,
      repo: true,
      unread: value?.splits ? { word: value, isValue: true } : undefined,
    };
  }
  if (/^(-R.|--repo=)/.test(word.text)) {
    return { width: 1, repo: true, unread: word.splits ? { word, isValue: true } : undefined };
  }
  return { width: 1, repo: false, unread: word.dynamic ? { word, isValue: false } : undefined };
}

// ---- Text that names a bypass ----

/** @param {string} text */
const namesAdminMerge = (text) =>
  /(?:^|[^\w-])--admin(?![\w-])/.test(text) && /\bmerge\b/.test(text);

/** @param {string} text */
const namesMergePath = (text) => /pulls\/[^/\s'"]+\/merge\b/.test(text);

/**
 * The refusal for text the hook does not parse as a command (an alias, a
 * script handed to an interpreter) when it names a bypass, or null.
 * @param {string} text
 */
function namedBypass(text) {
  if (namesAdminMerge(text)) return ADMIN_REASON + THROUGH_ANOTHER_PROGRAM;
  if (namesMergePath(text)) return REST_MERGE_REASON + THROUGH_ANOTHER_PROGRAM;
  return null;
}

/** @param {Word[]} words */
const wordsText = (words) => words.map(({ text }) => text).join(' ');

// ---- gh ----

// The gh pr actions that open, ready or merge a PR. A flag before one of
// these hides which action runs.
const GATED_PR_ACTIONS = new Set(['create', 'new', 'merge', 'ready']);

/**
 * Reads gh's flags when they come before its command word.
 *
 * The hook does not know which of gh's other flags take a value, so each one
 * may take the next word. The command word is then among the first
 * (flags + 1) words that are not flags: that is the window. `-R` and
 * `--repo` take a known value, so they are skipped and do not widen it.
 * - `words`: the words in the window, any of which may be the command.
 * - `unread`: the first flag in the window the hook cannot read (see
 *   {@link readLeadingFlag}). A flag after the window belongs to the command.
 * @param {Word[]} args  the words after `gh`
 * @returns {{ words: Word[], unread?: { word: Word, isValue: boolean } }}
 */
function readLeadingGhFlags(args) {
  /** @type {Word[]} */
  const others = [];
  let flags = 0;
  /** @type {{ word: Word, isValue: boolean } | undefined} */
  let unread;
  for (let i = 0; i < args.length; ) {
    const word = /** @type {Word} */ (args[i]);
    if (!word.text.startsWith('-')) {
      others.push(word);
      i++;
      continue;
    }
    const flag = readLeadingFlag(args, i);
    // While others.length <= flags, the command word may still be ahead.
    if (others.length <= flags) unread ??= flag.unread;
    if (!flag.repo) flags++;
    i += flag.width;
  }
  return { words: others.slice(0, flags + 1), unread };
}

/**
 * @param {Word[]} args  the words after `gh`
 * @returns {string | null}
 */
function checkGh(args) {
  const [group] = args;
  if (!group) return null;
  if (group.text.startsWith('-')) {
    const { words, unread } = readLeadingGhFlags(args);
    if (unread) return unreadReason('ghCommand', unread.word, unread.isValue);
    const hidden = words.some((word) => word.text === 'pr' || word.text === 'api' || word.dynamic);
    return hidden ? FLAGS_FIRST_REASON : null;
  }
  if (group.dynamic) return unreadReason('ghCommand', group);
  if (group.text === 'pr') return checkPr(args.slice(1));
  if (group.text === 'api') return checkApi(args.slice(1));
  // `gh alias set m 'pr merge --admin'` makes `gh m` a bypass.
  if (group.text === 'alias') return namedBypass(wordsText(args));
  return null;
}

/**
 * @param {Word[]} args  the words after `gh pr`
 * @returns {string | null}
 */
function checkPr(args) {
  let i = 0;
  while (args[i]?.text.startsWith('-')) {
    const flag = readLeadingFlag(args, i);
    if (flag.unread) return unreadReason('prAction', flag.unread.word, flag.unread.isValue);
    if (!flag.repo) {
      const rest = args.slice(i + 1);
      const hidden = rest.some((each) => GATED_PR_ACTIONS.has(each.text) || each.dynamic);
      return hidden ? ACTION_FIRST_REASON : null;
    }
    i += flag.width;
  }
  const action = args[i];
  if (action?.dynamic) return unreadReason('prAction', action);
  if (action && action.text !== 'merge') return null;
  return checkMerge(args.slice(i + 1));
}

const MERGE_VALUE_FLAGS = new Set([
  ...flagSet('author-email body body-file subject match-head-commit', ['-A', '-b', '-F', '-t']),
  ...GH_VALUE_FLAGS,
]);

/**
 * @param {Word[]} args  the words after `gh pr merge`
 * @returns {string | null}
 */
function checkMerge(args) {
  const merge = readGhFlags(args, MERGE_VALUE_FLAGS);
  // Any `--admin`, even `--admin=false`, is refused. The bypass reason wins
  // over the rewrite reason.
  if (merge.named('--admin') && !merge.help) return ADMIN_REASON;
  const unread = [
    ...merge.splitValues,
    ...merge.unreadFlags,
    ...merge.positional.filter((word) => word.dynamic),
  ][0];
  return unread ? unreadReason('prMerge', unread, merge.splitValues.includes(unread)) : null;
}

const MERGE_PATH = /\/pulls\/[^/]+\/merge$/;

/**
 * @param {Word[]} args  the words after `gh api`
 * @returns {string | null}
 */
function checkApi(args) {
  const api = readApiCall(args);
  if (api.help) return null;
  const { endpoint, more, method } = api;
  /** @type {Word[]} Words that may carry a flag the hook cannot see. */
  const hidden = [...api.splitValues, ...api.unreadFlags];
  // A run-time endpoint with more words after it may have been a flag.
  if (endpoint && (endpoint.splits || (endpoint.dynamic && more.length > 0))) hidden.push(endpoint);
  hidden.push(...more.filter((word) => word.dynamic));
  const unread = hidden[0];
  if (unread) {
    // Double quotes stop a flag value or the endpoint from splitting.
    const isValue = unread === endpoint || api.splitValues.includes(unread);
    return unreadReason('apiCall', unread, isValue);
  }
  if (!endpoint) return null;

  if (!method.dynamic && method.text === 'GET') return null;
  const path = urlPath(endpoint.text);
  if (MERGE_PATH.test(path)) return REST_MERGE_REASON;
  // A write to an endpoint built at run time may open or merge a PR. The
  // PR-open check in review-gate-policy.mjs reads only a literal endpoint,
  // and this check runs first on every shell call, so it covers both.
  return endpoint.dynamic ? unreadReason('apiWrite', endpoint) : null;
}

// ---- HTTP clients ----

const HTTPIE = new Set(['http', 'https', 'xh', 'xhs']);
const WRITE_METHOD = /^(PUT|POST|PATCH|DELETE)$/i;
const ANY_METHOD = /^(GET|HEAD|PUT|POST|PATCH|DELETE|OPTIONS)$/i;

/**
 * Whether an HTTP client call writes to a PR's `pulls/<N>/merge`. It reads
 * the last method named (`-X PUT`, `-XPUT`, `--request=PUT`,
 * `--method=PUT`, httpie's `PUT`) and the flags that send a body. A word the
 * shell splits (`{-XPUT,<url>}`) that names a merge path is refused too.
 * @param {string} program
 * @param {Word[]} args
 */
function checkHttp(program, args) {
  if (args.some((word) => word.splits && namesMergePath(word.text))) return REST_MERGE_REASON;
  const names = args.map(({ text }) => text.replace(/^--?[\w-]+=/, ''));
  if (!names.some((text) => MERGE_PATH.test(urlPath(text)))) return null;
  /** @type {string | undefined} */
  let method;
  let body = false;
  for (let i = 0; i < args.length; i++) {
    const text = args[i]?.text ?? '';
    const glued =
      /^-[a-zA-Z]*X=?([A-Za-z]+)$/.exec(text) ?? /^--(?:request|method)=(.+)$/.exec(text);
    if (glued) method = glued[1];
    else if (/^(-[a-zA-Z]*X|--request|--method)$/.test(text)) method = args[++i]?.text;
    else if (ANY_METHOD.test(text)) method = text;
    else if (/^(--data|--json|--form|--upload-file|--post-|--body-)/.test(text)) body = true;
    else if (program === 'curl' && /^-[a-zA-Z]*[dFT]/.test(text)) body = true;
    // httpie and xh: a data item (`a=b`, `a:=1`, `a@file`) sends a body.
    else if (HTTPIE.has(program) && /^[\w.[\]-]+(?::?=(?!=)|@)/.test(text)) body = true;
  }
  const writes = method ? WRITE_METHOD.test(method) : body;
  return writes ? REST_MERGE_REASON : null;
}

// ---- Other programs ----

// Programs that only read or print text, so text in their words that names
// a bypass is not run (a commit message, a note, a search).
const READERS = new Set([
  'echo',
  'printf',
  'cat',
  'tee',
  'grep',
  'egrep',
  'rg',
  'sed',
  'awk',
  'head',
  'tail',
  'wc',
  'jq',
]);

/**
 * git runs other programs only through an alias set on its command line
 * (`git -c alias.x='!gh ...' x`), so only those values are checked.
 * @param {Word[]} args  the words after `git`
 */
function checkGit(args) {
  const aliases = args.filter(
    (word, i) => args[i - 1]?.text === '-c' && /^alias\./.test(word.text),
  );
  return namedBypass(wordsText(aliases));
}

// Interpreters that may read a script from stdin or a heredoc.
const INTERPRETERS = /^(python[\d.]*|node|perl|ruby|deno|bun|php|osascript|lua|tclsh)$/;

/**
 * Whether a command may run text that is not in its own words: a shell with
 * no `-c` or an interpreter (either may read a pipe, a heredoc or a file),
 * or a program built at run time (`eval "$X"` after `X='...'`). For these the
 * whole script is checked.
 * @param {Command} command
 */
function runsScriptText(command) {
  const program = command.argv[0];
  if (program === undefined) return false;
  if (command.marks[0]?.dynamic) return true;
  const name = posix.basename(program);
  if (SHELLS.has(name)) return shellScriptOf(command.argv) === null;
  return INTERPRETERS.test(name);
}

/**
 * Whether the parser reads the script this command runs (`eval`, `bash -c`).
 * @param {Command} command
 */
const runsParsedScript = (command) =>
  command.argv[0] === 'eval' || shellScriptOf(command.argv) !== null;

/** @type {Record<string, (args: Word[], program: string) => string | null>} */
const CHECKERS = {
  gh: checkGh,
  git: checkGit,
  curl: (args) => checkHttp('curl', args),
  wget: (args) => checkHttp('wget', args),
  ...Object.fromEntries([...HTTPIE].map((name) => [name, (args) => checkHttp(name, args)])),
};

// ---- Entry ----

/**
 * The reason a shell script is refused because it bypasses branch
 * protection or hides a merge the hook cannot read, or null.
 * @param {string} script
 * @returns {string | null}
 */
export function findBypass(script) {
  const commands = parseCommands(script);
  for (const command of commands) {
    const program = posix.basename(command.argv[0] ?? '');
    const words = wordsOf(command);
    const check = CHECKERS[program];
    let reason = null;
    if (check) reason = check(words.slice(1), program);
    // Any other program (find -exec, pnpm exec, alias, python3 -c) may run
    // gh from its own words. `eval` and `bash -c` scripts are parsed, so
    // their commands come next in the list and get the checks above.
    else if (!READERS.has(program) && !runsParsedScript(command))
      reason = namedBypass(wordsText(words));
    if (reason) return reason;
  }
  return commands.some(runsScriptText) ? namedBypass(script) : null;
}
