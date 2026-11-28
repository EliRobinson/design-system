// @ts-check
// How the shell parser finds the program a command runs: the keywords,
// assignments and wrapper commands it looks past, and zsh's `=name` words.

import { posix } from 'node:path';

/** Words the shell reads as keywords at a command's front. */
export const KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'do',
  'done',
  'while',
  'until',
  'esac',
  '!',
  '{',
  '}',
]);

/** An assignment at a command's front, as in `A=1 x`. */
export const ASSIGNMENT = /^[A-Za-z_]\w*=/;

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

// A name zsh looks up on the PATH for `=name`: no `/`, and no `=`, so a
// rewritten word is never an assignment or another `=name`.
const PLAIN_NAME = /^[^/=]+$/;

// Builtins that only change the shell they run in. `=cd` runs the program
// `cd` on the PATH (macOS has `/usr/bin/cd`) in a process of its own, so it
// moves no folder: it is not read as the builtin.
const SHELL_ONLY = new Set(['cd', 'pushd', 'popd']);

/**
 * The program a word in a command's place runs when it starts with `=`.
 * zsh replaces `=name` with the path of the program `name` (its EQUALS
 * option, on by default), so `=gh pr create` runs gh. Returns null when the
 * word does not start with `=`, `{ name }` for a plain name, and
 * `{ name: null }` when the parser cannot tell what runs (`=`, `=a/b`,
 * `=cd`): a word built at run time.
 * @param {string} word
 * @returns {{ name: string | null } | null}
 */
export function equalsProgram(word) {
  if (!word.startsWith('=')) return null;
  const name = word.slice(1);
  return { name: PLAIN_NAME.test(name) && !SHELL_ONLY.has(name) ? name : null };
}

/**
 * Drops env assignments, shell keywords, `function <name>`, and wrapper
 * commands (with their flags) from the front of a command, and reads a zsh
 * `=name` there as `name` (see equalsProgram). Returns the assignments it
 * dropped as `env`.
 * @param {string[]} argv
 * @returns {{ argv: string[], env: string[] }}
 */
export function unwrap(argv) {
  let rest = argv;
  /** @type {string[]} */
  const env = [];
  for (;;) {
    const first = rest[0];
    if (first === undefined) return { argv: rest, env };
    const wrapper = WRAPPERS[posix.basename(first)];
    const equals = equalsProgram(first)?.name;
    if (equals) {
      rest = [equals, ...rest.slice(1)];
    } else if (ASSIGNMENT.test(first)) {
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
