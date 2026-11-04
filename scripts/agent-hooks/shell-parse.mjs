// @ts-check
// A small shell parser for the review gate hook. It is not a full shell: it
// finds every simple command in a script, including ones inside `$(...)`,
// backticks, `bash -c`, and `eval`, and ignores text inside quotes,
// comments, heredoc bodies, and `((...))`. See docs/agents/git-and-prs.md
// for what it does not catch.

import { posix } from 'node:path';

/**
 * A simple command.
 * - `env` holds the `NAME=value` assignments dropped from its front, as in
 *   `A=1 x` or `env A=1 x`.
 * - `scope` names the shells it runs in, outermost first: one id for each
 *   subshell, pipeline stage, background job (`&`), substitution, and nested
 *   `bash -c` around it. Two commands with the same `scope` run in the same
 *   shell, so a `cd` in one moves the other. A `{ ... }` group and the body
 *   of `if`, `while`, `until`, `for`, `select` and `case` get a NEGATIVE id.
 *   Bash runs those in the current shell unless they are piped or sent to
 *   the background, so a `cd` in one may or may not move what comes after.
 * - `top` is true when `scope` is empty. It is derived from `scope`.
 * @typedef {{ argv: string[], env: string[], scope: number[], top: boolean }} Command
 */

/** Hands out scope ids, unique within one parse. @typedef {{ last: number }} ScopeIds */

// Words that open and close a compound command's body.
const COMPOUND_OPENERS = new Set(['{', 'if', 'while', 'until', 'for', 'select', 'case']);
const COMPOUND_CLOSERS = new Set(['}', 'fi', 'done', 'esac']);
// Operators that end an and-or list, after which a `&` no longer reaches back.
const LIST_ENDS = new Set([';', ';;', '\n', '&']);

const OPERATORS = ['&&', '||', ';;', '|&', ';', '|', '&'];
const HEREDOC = /^<<(-?)[ \t]*(?:'([^']*)'|"([^"]*)"|([^\s;&|()<>]+))/;

/**
 * Reads one level of a script, from `start` to its `closer` (`)` for
 * `$(...)`, a backtick for backticks) or the end. One pass handles quotes,
 * substitutions, arithmetic, comments, redirects, and heredocs. Commands
 * come back in the order they run: a substitution's commands come before
 * the command that holds them.
 * @param {string} script
 * @param {number} start
 * @param {')' | '`' | null} closer
 * @param {number[]} scope The shells this level runs in.
 * @param {ScopeIds} ids
 * @returns {{ commands: Command[], end: number }}
 */
function readLevel(script, start, closer, scope, ids) {
  const newScope = () => ++ids.last;
  /** @type {Command[]} */
  const commands = [];
  /** @type {number[]} The open `(...)` groups and compound bodies. */
  const groups = [];
  // Where the current and-or list starts in `commands`. `a && b & c` sends
  // all of `a && b` to the background, not only `b`.
  let listStart = 0;
  /** @type {Array<{ delimiter: string, dash: boolean }>} */
  const heredocs = [];
  /** @type {string[]} */
  let argv = [];
  /** @type {string | null} */
  let word = null;
  let redirectTarget = false;
  // Whether the command being read takes its stdin from a pipe.
  let pipedIn = false;

  const append = (/** @type {string} */ text) => {
    word = (word ?? '') + text;
  };
  const endWord = () => {
    if (word === null) return;
    if (redirectTarget) redirectTarget = false;
    else argv.push(word);
    word = null;
  };
  const here = () => [...scope, ...groups];
  /** @type {number[]} How many `groups` entries each open compound body holds. */
  const compoundSizes = [];
  // Opens or closes a compound body at the front of the command's words.
  // Returns whether it opened one. A body that reads from a pipe runs, whole,
  // in that pipe stage's subshell, so the stage's scope goes around it.
  const trackCompound = () => {
    if (COMPOUND_CLOSERS.has(argv[0] ?? '')) groups.splice(-(compoundSizes.pop() ?? 1));
    let opened = false;
    for (const word of argv) {
      if (COMPOUND_OPENERS.has(word)) {
        const wrap = pipedIn && !opened;
        if (wrap) groups.push(newScope());
        groups.push(-newScope());
        compoundSizes.push(wrap ? 2 : 1);
        opened = true;
      } else if (!KEYWORDS.has(word)) break;
    }
    return opened;
  };
  // `op` is the operator that ends the command, if any. Each stage of a
  // pipeline runs in a subshell, and so does an and-or list sent to the
  // background.
  const endCommand = (/** @type {string | null} */ op = null) => {
    endWord();
    const opened = trackCompound();
    const piped = op === '|' || op === '|&';
    const own = (pipedIn && !opened) || piped ? [...here(), newScope()] : here();
    const { argv: command, env } = unwrap(argv);
    if (command.length > 0)
      commands.push({ argv: command, env, scope: own, top: own.length === 0 });
    if (op === '&') {
      const id = newScope();
      const at = here().length;
      for (const each of commands.slice(listStart)) {
        each.scope = [...each.scope.slice(0, at), id, ...each.scope.slice(at)];
        each.top = false;
      }
    }
    if (op !== null && LIST_ENDS.has(op)) listStart = commands.length;
    argv = [];
    pipedIn = piped;
  };
  // Reads a nested script and keeps its source text in the current word.
  const readNested = (/** @type {number} */ from, /** @type {')' | '`'} */ close) => {
    const level = readLevel(script, from, close, [...here(), newScope()], ids);
    commands.push(...level.commands);
    append(script.slice(from - (close === '`' ? 1 : 2), level.end));
    return level.end;
  };
  // Skips `((...))` or `$((...))`, whose `<<` is a shift, not a heredoc.
  const skipArithmetic = (/** @type {number} */ from, /** @type {number} */ open) => {
    let depth = 0;
    for (let i = from + open; i < script.length; i++) {
      if (script[i] === '(') depth++;
      else if (script[i] === ')' && depth-- === 0 && script[i + 1] === ')') {
        append(script.slice(from, i + 2));
        return i + 2;
      }
    }
    append(script.slice(from));
    return script.length;
  };
  // Skips heredoc bodies, starting at the line after the one that opened them.
  const skipHeredocBodies = (/** @type {number} */ from) => {
    let i = from;
    while (heredocs.length > 0 && i < script.length) {
      const newline = script.indexOf('\n', i);
      const lineEnd = newline === -1 ? script.length : newline;
      const line = script.slice(i, lineEnd);
      const heredoc = heredocs[0];
      if ((heredoc?.dash ? line.replace(/^\t+/, '') : line) === heredoc?.delimiter)
        heredocs.shift();
      i = lineEnd + 1;
    }
    return i;
  };

  let i = start;
  while (i < script.length) {
    const ch = script[i] ?? '';
    const next = script[i + 1];
    const arithmetic =
      (ch === '$' && next === '(' && script[i + 2] === '(') ||
      (ch === '(' && next === '(' && word === null);

    if ((closer === '`' && ch === '`') || (closer === ')' && ch === ')' && groups.length === 0)) {
      endCommand();
      return { commands, end: i + 1 };
    }
    if (ch === ' ' || ch === '\t') {
      endWord();
      i++;
    } else if (ch === '#' && word === null) {
      while (i < script.length && script[i] !== '\n') i++;
    } else if (ch === '\\') {
      if (next !== '\n') append(next ?? '');
      i += 2;
    } else if (ch === "'") {
      const end = script.indexOf("'", i + 1);
      const close = end === -1 ? script.length : end;
      append(script.slice(i + 1, close));
      i = close + 1;
    } else if (ch === '"') {
      append('');
      i++;
      while (i < script.length && script[i] !== '"') {
        const inner = script[i];
        if (inner === '\\') {
          append(script[i + 1] ?? '');
          i += 2;
        } else if (inner === '$' && script[i + 1] === '(' && script[i + 2] === '(') {
          i = skipArithmetic(i, 3);
        } else if (inner === '$' && script[i + 1] === '(') {
          i = readNested(i + 2, ')');
        } else if (inner === '`') {
          i = readNested(i + 1, '`');
        } else {
          append(inner ?? '');
          i++;
        }
      }
      i++;
    } else if (arithmetic) {
      i = skipArithmetic(i, ch === '$' ? 3 : 2);
    } else if (ch === '$' && next === '(') {
      i = readNested(i + 2, ')');
    } else if (ch === '`') {
      i = readNested(i + 1, '`');
    } else if (script.startsWith('<<<', i)) {
      endWord();
      redirectTarget = true;
      i += 3;
    } else if (ch === '<' && next === '<') {
      endWord();
      const match = HEREDOC.exec(script.slice(i));
      if (match) {
        const delimiter = (match[2] ?? match[3] ?? match[4] ?? '').replace(/\\/g, '');
        heredocs.push({ delimiter, dash: match[1] === '-' });
        i += match[0].length;
      } else {
        i += 2;
      }
    } else if (ch === '&' && next === '>') {
      // `&>` and `&>>` send stdout and stderr to a file. Not a background job.
      endWord();
      i += script[i + 2] === '>' ? 3 : 2;
      redirectTarget = true;
    } else if (ch === '<' || ch === '>') {
      // A file descriptor before a redirect, as in `2>&1`, is not a word.
      if (word !== null && /^\d+$/.test(word)) word = null;
      endWord();
      i++;
      while (/[<>&|]/.test(script[i] ?? '')) i++;
      redirectTarget = true;
    } else if (ch === '(') {
      endCommand();
      groups.push(newScope());
      i++;
    } else if (ch === ')') {
      endCommand();
      groups.pop();
      i++;
    } else if (ch === '\n') {
      endCommand('\n');
      i = heredocs.length > 0 ? skipHeredocBodies(i + 1) : i + 1;
    } else {
      const op = OPERATORS.find((candidate) => script.startsWith(candidate, i));
      if (op) {
        endCommand(op);
        i += op.length;
      } else {
        append(ch);
        i++;
      }
    }
  }
  endCommand();
  return { commands, end: script.length };
}

const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}']);

// Commands that run the rest of their argv as a command, with the flags of
// theirs that take a value, and how many positional args come first.
/** @type {Record<string, { valueFlags: string[], positional?: number }>} */
const WRAPPERS = {
  builtin: { valueFlags: [] },
  command: { valueFlags: [] },
  env: { valueFlags: ['-u', '--unset', '-C', '--chdir'] },
  exec: { valueFlags: ['-a'] },
  nice: { valueFlags: ['-n', '--adjustment'] },
  nohup: { valueFlags: [] },
  npx: { valueFlags: ['-p', '--package'] },
  sudo: {
    valueFlags: [
      '-u',
      '--user',
      '-g',
      '--group',
      '-h',
      '--host',
      '-p',
      '--prompt',
      '-C',
      '-D',
      '-r',
      '-t',
      '-U',
      '-T',
    ],
  },
  time: { valueFlags: ['-f', '--format', '-o', '--output'] },
  timeout: {
    valueFlags: ['-s', '--signal', '-k', '--kill-after'],
    positional: 1,
  },
  xargs: { valueFlags: ['-I', '-L', '-n', '-P', '-d', '-E', '-s', '-a'] },
};
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const ASSIGNMENT = /^[A-Za-z_]\w*=/;

/**
 * Drops env assignments, shell keywords, `function <name>`, and wrapper
 * commands (with their flags) from the front of a command. Returns the
 * assignments it dropped as `env`.
 * @param {string[]} argv
 * @returns {{ argv: string[], env: string[] }}
 */
function unwrap(argv) {
  let rest = argv;
  /** @type {string[]} */
  const env = [];
  for (;;) {
    const first = rest[0];
    if (first === undefined) return { argv: rest, env };
    const wrapper = WRAPPERS[posix.basename(first)];
    if (ASSIGNMENT.test(first)) {
      env.push(first);
      rest = rest.slice(1);
    } else if (KEYWORDS.has(first)) {
      rest = rest.slice(1);
    } else if (first === 'function') {
      rest = rest.slice(2);
    } else if (wrapper) {
      rest = rest.slice(1);
      while (rest[0]?.startsWith('-')) {
        const flag = rest[0];
        rest = rest.slice(wrapper.valueFlags.includes(flag) ? 2 : 1);
        if (flag === '--') break;
      }
      rest = rest.slice(wrapper.positional ?? 0);
    } else {
      return { argv: rest, env };
    }
  }
}

/**
 * The script a shell runs with `-c`, as in `bash -lc '<script>'`.
 * @param {string[]} argv
 * @returns {string | null}
 */
export function shellScriptOf(argv) {
  if (!SHELLS.has(posix.basename(argv[0] ?? ''))) return null;
  const flag = argv.findIndex((arg, i) => i > 0 && /^-[a-zA-Z]*c[a-zA-Z]*$/.test(arg));
  return flag === -1 ? null : (argv[flag + 1] ?? null);
}

/**
 * Joins argv into a script that parses back to the same words.
 * @param {string[]} argv
 */
export function quoteArgv(argv) {
  return argv.map((arg) => `'${arg.replace(/'/g, `'\\''`)}'`).join(' ');
}

/**
 * Every simple command in the script, in the order they run. The commands
 * of a `bash -c` or `eval` script come right after the command that runs
 * them. A `bash -c` script runs in a new shell, so it gets a scope of its
 * own. An `eval` script runs in the shell that runs `eval`.
 * @param {string} script
 * @param {number} [depth]
 * @param {number[]} [scope]
 * @param {ScopeIds} [ids]
 * @returns {Command[]}
 */
export function parseCommands(script, depth = 0, scope = [], ids = { last: 0 }) {
  if (depth > 5) return [];
  /** @type {Command[]} */
  const all = [];
  for (const command of readLevel(script, 0, null, scope, ids).commands) {
    all.push(command);
    const { argv } = command;
    const shellScript = shellScriptOf(argv);
    if (shellScript !== null) {
      all.push(...parseCommands(shellScript, depth + 1, [...command.scope, ++ids.last], ids));
    } else if (argv[0] === 'eval') {
      all.push(...parseCommands(argv.slice(1).join(' '), depth + 1, command.scope, ids));
    }
  }
  return all;
}

/**
 * The folder `cd <target>` (or `pushd <target>`) moves to from `dir`, or
 * null when a parser cannot tell: no target, `-`, a flag, a leading `~`, or
 * anything built at run time (`$`, backticks). A null `dir` stays null.
 * @param {string | null} dir
 * @param {string | undefined} target
 * @returns {string | null}
 */
export function cdTarget(dir, target) {
  if (dir === null || target === undefined || /^[-~]|[$`]/.test(target)) return null;
  return posix.resolve(dir, target);
}
