// @ts-check
// Reads a gh command's flags the way gh does (gh parses them with pflag).
// Both review gate checks use it: the PR-open check in review-gate-policy.mjs
// and the merge-bypass check in review-gate-bypass.mjs. No I/O.

import { posix } from 'node:path';

/** @typedef {import('./shell-parse.mjs').Word} Word */

/**
 * @param {string} longNames  space-separated, without the `--`
 * @param {string[]} shortFlags
 */
export function flagSet(longNames, shortFlags) {
  return new Set([...longNames.split(' ').map((name) => `--${name}`), ...shortFlags]);
}

// The values pflag reads as true for a boolean flag (`strconv.ParseBool`).
const TRUE = /^(1|t|true)$/i;

/**
 * Reads gh's flags from the words after a gh command, as pflag does:
 * - A value flag takes `--flag=value`, `--flag value`, `-fvalue`, `-f=value`
 *   or `-f value`.
 * - Short flags bundle, as in `-dw` or `-dF body.md`: the first value flag
 *   takes the rest of the word (past one `=`), or the next word. A boolean
 *   flag in a bundle may take `=value` too, as in `-w=false`.
 * - `--` ends the flags; every word after it is positional.
 *
 * It returns:
 * - `values(...aliases)`: the values given to a value flag, in command order.
 *   A value glued to its flag keeps that word's marks.
 * - `has(...aliases)`: whether pflag reads a boolean flag as set: its last
 *   use is bare or `=1`, `=t` or `=true`. `=false`, `=0`, or a value built
 *   at run time is not set.
 * - `named(...aliases)`: whether the flag is written at all, with any value.
 * - `positional`: the words that are not flags or flag values.
 * - `splitValues`: flag values the shell may split into more words.
 * - `unread`: words built at run time that are not a flag's value: a flag
 *   word with no value read from it, or a positional word. Each may become a
 *   flag the reader cannot see.
 * @param {Word[]} words
 * @param {Set<string>} valueFlags
 */
export function readGhFlags(words, valueFlags) {
  /** @type {{ name: string, value: Word | undefined, bare: boolean }[]} */
  const uses = [];
  /** @type {Word[]} */
  const positional = [];
  /** @type {Word[]} */
  const splitValues = [];
  /** @type {Word[]} */
  const unread = [];
  /**
   * @param {string} name
   * @param {Word | undefined} value
   */
  const take = (name, value) => {
    uses.push({ name, value, bare: false });
    if (value?.splits) splitValues.push(value);
  };
  /**
   * @param {Word} word
   * @param {string} name
   * @param {string | undefined} value  after `=`, or undefined when bare
   */
  const flag = (word, name, value) =>
    uses.push({
      name,
      value: value === undefined ? undefined : { ...word, text: value },
      bare: value === undefined,
    });

  for (let i = 0; i < words.length; i++) {
    const word = /** @type {Word} */ (words[i]);
    const { text } = word;
    if (text === '--') {
      positional.push(...words.slice(i + 1));
      unread.push(...words.slice(i + 1).filter((each) => each.dynamic));
      break;
    }
    if (text.startsWith('--')) {
      const eq = text.indexOf('=');
      const name = eq === -1 ? text : text.slice(0, eq);
      if (valueFlags.has(name)) {
        take(name, eq === -1 ? words[++i] : { ...word, text: text.slice(eq + 1) });
        continue;
      }
      flag(word, name, eq === -1 ? undefined : text.slice(eq + 1));
      if (word.dynamic) unread.push(word);
    } else if (text.startsWith('-') && text.length > 1) {
      let tookValue = false;
      // gh's short flags are letters; a word built at run time may hide
      // anything past the first other character.
      for (let k = 1; k < text.length && /[a-zA-Z]/.test(text[k] ?? ''); k++) {
        const name = `-${text[k]}`;
        const from = text[k + 1] === '=' ? k + 2 : k + 1;
        if (valueFlags.has(name)) {
          take(name, from < text.length ? { ...word, text: text.slice(from) } : words[++i]);
          tookValue = true;
          break;
        }
        if (text[k + 1] === '=') {
          flag(word, name, text.slice(from));
          break;
        }
        flag(word, name, undefined);
      }
      if (!tookValue && word.dynamic) unread.push(word);
    } else {
      positional.push(word);
      if (word.dynamic) unread.push(word);
    }
  }

  const usesOf = (/** @type {string[]} */ aliases) =>
    uses.filter(({ name }) => aliases.includes(name));
  return {
    /** @param {string[]} aliases */
    values: (...aliases) => usesOf(aliases).flatMap(({ value }) => value ?? []),
    /** @param {string[]} aliases */
    has: (...aliases) => {
      const last = usesOf(aliases).at(-1);
      if (!last) return false;
      return last.bare || (!last.value?.dynamic && TRUE.test(last.value?.text ?? ''));
    },
    /** @param {string[]} aliases */
    named: (...aliases) => usesOf(aliases).length > 0,
    positional,
    splitValues,
    unread,
  };
}

// ---- gh api ----

export const API_VALUE_FLAGS = flagSet(
  'method raw-field field header input jq template cache preview hostname',
  ['-X', '-f', '-F', '-H', '-q', '-t', '-p'],
);

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

/**
 * Reads a `gh api` call: its flags, the endpoint and the words after it, the
 * fields and input files, and the method. gh sends GET, or POST when a field
 * or `--input` is given, unless `-X` or `--method` names one. `method` is
 * upper case, and `dynamic` when the shell builds it at run time.
 * @param {Word[]} words  the words after `gh api`
 */
export function readApiCall(words) {
  const flags = readGhFlags(words, API_VALUE_FLAGS);
  const fields = flags.values('-f', '--raw-field', '-F', '--field');
  const inputs = flags.values('--input');
  const named = flags.values('-X', '--method').at(-1);
  const method = named
    ? { text: named.text.toUpperCase(), dynamic: named.dynamic }
    : { text: fields.length + inputs.length > 0 ? 'POST' : 'GET', dynamic: false };
  const [endpoint, ...more] = flags.positional;
  return { ...flags, endpoint, more, fields, inputs, method };
}
