// @ts-check
// A small shell parser for the review gate hook. It is not a full shell: it
// finds every simple command in a script, including ones inside `$(...)`,
// backticks, `bash -c`, and `eval`, and ignores text inside quotes,
// comments, heredoc bodies, and `((...))`. See docs/agents/git-and-prs.md
// for what it does not catch.

import { posix } from 'node:path';

/**
 * A simple command. `top` is true when it runs in the script's own shell:
 * not in a subshell, a substitution, or a nested `bash -c` or `eval`.
 * @typedef {{ argv: string[], top: boolean }} Command
 */

const OPERATORS = ['&&', '||', ';;', '|&', ';', '|', '&'];
const HEREDOC = /^<<(-?)[ \t]*(?:'([^']*)'|"([^"]*)"|([^\s;&|()<>]+))/;

/**
 * Reads one level of a script, from `start` to its `closer` (`)` for
 * `$(...)`, a backtick for backticks) or the end. One pass handles quotes,
 * substitutions, arithmetic, comments, redirects, and heredocs.
 * @param {string} script
 * @param {number} start
 * @param {')' | '`' | null} closer
 * @param {boolean} top
 * @returns {{ commands: Command[], end: number }}
 */
function readLevel(script, start, closer, top) {
  /** @type {Command[]} */
  const commands = [];
  /** @type {Command[]} */
  const nested = [];
  /** @type {Array<{ delimiter: string, dash: boolean }>} */
  const heredocs = [];
  /** @type {string[]} */
  let argv = [];
  /** @type {string | null} */
  let word = null;
  let redirectTarget = false;
  let subshell = 0;

  const append = (/** @type {string} */ text) => {
    word = (word ?? '') + text;
  };
  const endWord = () => {
    if (word === null) return;
    if (redirectTarget) redirectTarget = false;
    else argv.push(word);
    word = null;
  };
  const endCommand = () => {
    endWord();
    const command = unwrap(argv);
    if (command.length > 0) commands.push({ argv: command, top: top && subshell === 0 });
    argv = [];
  };
  // Reads a nested script and keeps its source text in the current word.
  const readNested = (/** @type {number} */ from, /** @type {')' | '`'} */ close) => {
    const level = readLevel(script, from, close, false);
    nested.push(...level.commands);
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

    if ((closer === '`' && ch === '`') || (closer === ')' && ch === ')' && subshell === 0)) {
      endCommand();
      return { commands: [...commands, ...nested], end: i + 1 };
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
    } else if (ch === '<' || ch === '>') {
      // A file descriptor before a redirect, as in `2>&1`, is not a word.
      if (word !== null && /^\d+$/.test(word)) word = null;
      endWord();
      i++;
      while (/[<>&|]/.test(script[i] ?? '')) i++;
      redirectTarget = true;
    } else if (ch === '(') {
      endCommand();
      subshell++;
      i++;
    } else if (ch === ')') {
      endCommand();
      subshell = Math.max(0, subshell - 1);
      i++;
    } else if (ch === '\n') {
      endCommand();
      i = heredocs.length > 0 ? skipHeredocBodies(i + 1) : i + 1;
    } else {
      const op = OPERATORS.find((candidate) => script.startsWith(candidate, i));
      if (op) {
        endCommand();
        i += op.length;
      } else {
        append(ch);
        i++;
      }
    }
  }
  endCommand();
  return { commands: [...commands, ...nested], end: script.length };
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
 * commands (with their flags) from the front of a command.
 * @param {string[]} argv
 */
function unwrap(argv) {
  let rest = argv;
  for (;;) {
    const first = rest[0];
    if (first === undefined) return rest;
    const wrapper = WRAPPERS[posix.basename(first)];
    if (ASSIGNMENT.test(first) || KEYWORDS.has(first)) {
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
      return rest;
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
 * Every simple command in the script. Commands of the script itself come
 * first, in order; commands from nested scripts follow.
 * @param {string} script
 * @param {number} [depth]
 * @returns {Command[]}
 */
export function parseCommands(script, depth = 0) {
  if (depth > 5) return [];
  const { commands } = readLevel(script, 0, null, depth === 0);
  /** @type {Command[]} */
  const inner = [];
  for (const { argv } of commands) {
    const shellScript = shellScriptOf(argv);
    if (shellScript !== null) inner.push(...parseCommands(shellScript, depth + 1));
    else if (argv[0] === 'eval') inner.push(...parseCommands(argv.slice(1).join(' '), depth + 1));
  }
  return [...commands, ...inner];
}
