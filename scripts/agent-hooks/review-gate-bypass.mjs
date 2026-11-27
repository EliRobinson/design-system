// @ts-check
// Merges that bypass branch protection, which the review gate always
// refuses, whatever the PR's Review section says. See
// docs/agents/git-and-prs.md#merges-that-bypass-branch-protection.
// No I/O, like review-gate-policy.mjs.

import { posix } from 'node:path';

import { SHELLS, parseCommands, shellScriptOf } from './shell-parse.mjs';

/** @typedef {import('./shell-parse.mjs').Command} Command */
/** @typedef {{ text: string, dynamic: boolean, splits: boolean }} Word */

const ASK_ELI =
  'Never bypass branch protection. If a plain `gh pr merge` is refused because a check fails or a branch rule blocks it, stop and ask Eli in chat, and say what blocks it. Do not look for another way around it.';
const NOT_CLEARED =
  'A Review section does not clear this, and neither does writing the bypass another way.';

export const ADMIN_REASON = `\`gh pr merge --admin\` (even \`--admin=false\`) merges past required checks and branch rules. Remove \`--admin\`. ${ASK_ELI} ${NOT_CLEARED}`;
export const REST_MERGE_REASON = `A merge through the REST API (\`pulls/<N>/merge\`) skips the branch protection check that \`gh pr merge\` makes, so with admin rights it is the same bypass as \`--admin\`. Use a plain \`gh pr merge\`. ${ASK_ELI} ${NOT_CLEARED}`;
const FLAGS_FIRST_REASON =
  'The hook cannot tell which gh command this is when flags come before the subcommand. Write `gh pr ...` or `gh api ...` with the subcommand first and the flags after it.';
const ACTION_FIRST_REASON =
  'The hook cannot tell where the gh pr action is when a flag other than `-R` comes before it. Write the action right after `gh pr`, then the flags.';

/**
 * @param {Word} word
 * @param {string} where
 */
function unreadReason(word, where) {
  const quote = word.splits && !/\$@|\[[@*]\]|\$\{[=(]/.test(word.text);
  return `The hook cannot read \`${word.text}\` in this ${where}: the shell builds it at run time, and it may become a flag such as \`--admin\` or \`-X PUT\`. Write the PR number, the endpoint and every flag out in full${quote ? ', and put a flag value in double quotes' : ''}.`;
}

// ---- gh ----

const REPO_FLAGS = ['-R', '--repo'];
// The gh pr actions the review gate checks. A flag before one of these hides it.
const GATED_PR_ACTIONS = new Set(['create', 'new', 'merge', 'ready']);

/**
 * The words that may be gh's subcommand when flags come first. Each flag may
 * take one word as its value, so the subcommand is among the first
 * (flags + 1) other words. The value of `-R` or `--repo` is known, so it is
 * skipped.
 * @param {Word[]} args
 */
function leadingSubcommandWords(args) {
  /** @type {Word[]} */
  const others = [];
  let flags = 0;
  for (let i = 0; i < args.length; i++) {
    const text = args[i]?.text ?? '';
    if (!text.startsWith('-')) others.push(/** @type {Word} */ (args[i]));
    else if (REPO_FLAGS.includes(text)) i++;
    else flags++;
  }
  return others.slice(0, flags + 1);
}

/**
 * @param {Word[]} args  the words after `gh`
 * @returns {string | null}
 */
function checkGh(args) {
  const [group] = args;
  if (!group) return null;
  if (group.text.startsWith('-')) {
    const hidden = leadingSubcommandWords(args).some(
      (word) => word.text === 'pr' || word.text === 'api' || word.dynamic,
    );
    return hidden ? FLAGS_FIRST_REASON : null;
  }
  if (group.dynamic) return unreadReason(group, 'gh command');
  if (group.text === 'pr') return checkPr(args.slice(1));
  if (group.text === 'api') return checkApi(args.slice(1));
  return null;
}

/**
 * @param {Word[]} args  the words after `gh pr`
 * @returns {string | null}
 */
function checkPr(args) {
  /** @type {Word[]} */
  const splitValues = [];
  let i = 0;
  for (; i < args.length; i++) {
    const word = /** @type {Word} */ (args[i]);
    if (!word.text.startsWith('-')) break;
    if (REPO_FLAGS.includes(word.text)) {
      const value = args[++i];
      if (value?.splits) splitValues.push(value);
    } else if (/^(-R.|--repo=)/.test(word.text)) {
      if (word.splits) splitValues.push(word);
    } else {
      const rest = args.slice(i + 1);
      const hidden = rest.some((each) => GATED_PR_ACTIONS.has(each.text) || each.dynamic);
      return hidden ? ACTION_FIRST_REASON : null;
    }
  }
  const action = args[i];
  if (action?.dynamic) return unreadReason(action, 'gh pr command');
  if (action && action.text !== 'merge') return null;
  return checkMerge(args.slice(i + 1), splitValues);
}

const MERGE_VALUE_FLAGS = new Set([
  '-A',
  '--author-email',
  '-b',
  '--body',
  '-F',
  '--body-file',
  '-t',
  '--subject',
  '--match-head-commit',
  '-R',
  '--repo',
]);

/**
 * @param {Word[]} args  the words after `gh pr merge`
 * @param {Word[]} splitValues  flag values already read that the shell splits
 * @returns {string | null}
 */
function checkMerge(args, splitValues) {
  let admin = false;
  let help = false;
  /** @type {Word[]} Words built at run time that are not a flag's value. */
  const runtime = [];
  const takeValue = (/** @type {Word | undefined} */ value) => {
    if (value?.splits) splitValues.push(value);
  };
  for (let i = 0; i < args.length; i++) {
    const word = /** @type {Word} */ (args[i]);
    const { text } = word;
    if (text === '--') {
      runtime.push(...args.slice(i + 1).filter((each) => each.dynamic));
      break;
    }
    if (text.startsWith('--')) {
      const eq = text.indexOf('=');
      const name = eq === -1 ? text : text.slice(0, eq);
      if (name === '--admin') admin = true;
      else if (name === '--help') help = true;
      else if (MERGE_VALUE_FLAGS.has(name)) {
        if (eq === -1) takeValue(args[++i]);
        else takeValue(word);
        continue;
      }
      if (word.dynamic) runtime.push(word);
    } else if (text.startsWith('-') && text.length > 1) {
      let tookValue = false;
      for (let k = 1; k < text.length; k++) {
        const flag = `-${text[k]}`;
        if (flag === '-h') help = true;
        if (MERGE_VALUE_FLAGS.has(flag)) {
          takeValue(k + 1 === text.length ? args[++i] : word);
          tookValue = true;
          break;
        }
      }
      if (!tookValue && word.dynamic) runtime.push(word);
    } else if (word.dynamic) {
      runtime.push(word);
    }
  }
  // The bypass reason wins over the rewrite reason.
  if (admin && !help) return ADMIN_REASON;
  const unread = splitValues[0] ?? runtime[0];
  return unread ? unreadReason(unread, 'gh pr merge') : null;
}

const API_VALUE_FLAGS = new Set([
  '--method',
  '--raw-field',
  '--field',
  '--header',
  '--input',
  '--jq',
  '--template',
  '--cache',
  '--preview',
  '--hostname',
  '-X',
  '-f',
  '-F',
  '-H',
  '-q',
  '-t',
  '-p',
]);

/**
 * The first value flag in a short group, as gh reads it: `-iXPUT` and
 * `-X=PUT` both give `-X`, with `from` just past the letter (and past one
 * `=`). Null when the word is not a short group with a value flag.
 * @param {string} text
 */
function shortValueFlag(text) {
  if (!/^-[a-zA-Z]/.test(text)) return null;
  for (let k = 1; k < text.length && /[a-zA-Z]/.test(text[k] ?? ''); k++) {
    const name = `-${text[k]}`;
    if (API_VALUE_FLAGS.has(name)) return { name, from: text[k + 1] === '=' ? k + 2 : k + 1 };
  }
  return null;
}

/**
 * A URL or endpoint as a path: no scheme, host, query or fragment, with
 * `%`-encoding and `..` resolved.
 * @param {string} text
 */
export function urlPath(text) {
  let path = text.replace(/^[a-z][\w+.-]*:\/\/[^/]*/i, '').replace(/[?#].*$/, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep it as written.
  }
  return posix.normalize(`/${path}`).replace(/\/+$/, '');
}

const MERGE_PATH = /\/pulls\/[^/]+\/merge$/;

/**
 * @param {Word[]} args  the words after `gh api`
 * @returns {string | null}
 */
function checkApi(args) {
  /** @type {Word[]} */
  const methods = [];
  /** @type {Word[]} */
  const positional = [];
  /** @type {Word[]} Words that may carry a flag the hook cannot see. */
  const hidden = [];
  let body = false;
  let help = false;
  const take = (/** @type {string} */ name, /** @type {Word | undefined} */ value) => {
    if (!value) return;
    if (value.splits) hidden.push(value);
    if (name === '-X' || name === '--method') methods.push(value);
    if (['-f', '-F', '--field', '--raw-field', '--input'].includes(name)) body = true;
  };
  for (let i = 0; i < args.length; i++) {
    const word = /** @type {Word} */ (args[i]);
    const { text } = word;
    if (text === '--') {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (text.startsWith('--')) {
      const eq = text.indexOf('=');
      const name = eq === -1 ? text : text.slice(0, eq);
      if (name === '--help') help = true;
      if (API_VALUE_FLAGS.has(name)) {
        take(name, eq === -1 ? args[++i] : { ...word, text: text.slice(eq + 1) });
      } else if (word.dynamic) {
        hidden.push(word);
      }
    } else if (text.startsWith('-') && text.length > 1) {
      const short = shortValueFlag(text);
      if (text === '-h') help = true;
      if (short) {
        take(
          short.name,
          short.from < text.length ? { ...word, text: text.slice(short.from) } : args[++i],
        );
      } else if (word.dynamic) {
        hidden.push(word);
      }
    } else {
      positional.push(word);
    }
  }
  if (help) return null;
  const [endpoint, ...more] = positional;
  // A run-time endpoint with more words after it may have been a flag.
  if (endpoint && (endpoint.splits || (endpoint.dynamic && more.length > 0))) hidden.push(endpoint);
  hidden.push(...more.filter((word) => word.dynamic));
  if (hidden[0]) return unreadReason(hidden[0], 'gh api call');
  if (!endpoint) return null;

  const method = methods.at(-1);
  const isGet = method ? !method.dynamic && method.text.toUpperCase() === 'GET' : !body;
  if (isGet) return null;
  const path = urlPath(endpoint.text);
  if (MERGE_PATH.test(path)) return REST_MERGE_REASON;
  // A write whose last path segment is built at run time may be a merge.
  if (endpoint.dynamic && /[$`]/.test(path.split('/').at(-1) ?? '')) {
    return `The hook cannot tell which endpoint this gh api write goes to, and it may be a PR merge. Write the endpoint out in full.`;
  }
  return null;
}

// ---- HTTP clients ----

const HTTPIE = new Set(['http', 'https', 'xh', 'xhs']);
const HTTP_CLIENTS = new Set(['curl', 'wget', ...HTTPIE]);
const WRITE_METHOD = /^(PUT|POST|PATCH|DELETE)$/i;
const ANY_METHOD = /^(GET|HEAD|PUT|POST|PATCH|DELETE|OPTIONS)$/i;

/**
 * Whether an HTTP client call writes to a PR's `pulls/<N>/merge`. It reads
 * the last method named (`-X PUT`, `-XPUT`, `--request=PUT`,
 * `--method=PUT`, httpie's `PUT`) and the flags that send a body.
 * @param {string} program
 * @param {Word[]} args
 */
function checkHttp(program, args) {
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

// ---- Text the hook cannot parse ----

// Programs handed a command as text the parser does not read.
const TEXT_RUNNERS =
  /^(python[\d.]*|node|perl|ruby|deno|bun|php|osascript|lua|tclsh|alias|source|\.)$/;

/**
 * Whether a command runs text the parser does not read: a shell with no
 * `-c` (it reads a pipe, a heredoc or a file), an interpreter, `alias`,
 * `source`, or a program built at run time.
 * @param {Command} command
 */
function runsUnreadText(command) {
  const program = command.argv[0];
  if (program === undefined) return false;
  if (command.marks[0]?.dynamic) return true;
  const name = posix.basename(program);
  if (SHELLS.has(name)) return shellScriptOf(command.argv) === null;
  return TEXT_RUNNERS.test(name);
}

/** @param {string} text */
const namesAdminMerge = (text) =>
  /(?:^|[^\w-])--admin(?![\w-])/.test(text) && /\bmerge\b/.test(text);

/** @param {string} text */
const namesMergePath = (text) => /pulls\/[^/\s'"]+\/merge\b/.test(text);

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
    const words = command.argv.map((text, i) => ({
      text,
      dynamic: command.marks[i]?.dynamic ?? false,
      splits: command.marks[i]?.splits ?? false,
    }));
    const reason =
      program === 'gh'
        ? checkGh(words.slice(1))
        : HTTP_CLIENTS.has(program)
          ? checkHttp(program, words.slice(1))
          : null;
    if (reason) return reason;
  }
  if (commands.some(runsUnreadText)) {
    const run = ' Run gh directly, not through another program.';
    if (namesAdminMerge(script)) return ADMIN_REASON + run;
    if (namesMergePath(script)) return REST_MERGE_REASON + run;
  }
  return null;
}
