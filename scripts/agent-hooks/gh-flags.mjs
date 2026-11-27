// @ts-check
// Reads a gh command's flags the way gh does (gh parses them with pflag),
// and a `gh api` call's endpoint and method. Both review gate checks use it:
// the PR-open check in review-gate-policy.mjs and the merge-bypass check in
// review-gate-bypass.mjs, which also uses `urlPath` for curl and httpie
// URLs. No I/O.

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
 * - `has(...aliases)`: whether pflag surely reads a boolean flag as set: its
 *   last use is bare or `=1`, `=t` or `=true`. `=false`, `=0`, or a value
 *   built at run time is not set. Pass one flag's aliases per call: for
 *   different flags, call it once each.
 * - `maybe(...aliases)`: like `has`, but a value built at run time counts as
 *   set.
 * - `named(...aliases)`: whether the flag is written at all, with any value.
 * - `help`: whether gh shows help and runs nothing (`has('-h', '--help')`).
 * - `positional`: the words that are not flags or flag values.
 * - `splitValues`: flag values the shell may split into more words.
 * - `unreadFlags`: flag words built at run time that no value was read from.
 *   Each may become a flag the reader cannot see.
 * @param {Word[]} words
 * @param {Set<string>} valueFlags
 */
export function readGhFlags(words, valueFlags) {
  /** @type {{ name: string, kind: 'value' | 'bool', value: Word | undefined }[]} */
  const uses = [];
  /** @type {Word[]} */
  const positional = [];
  /** @type {Word[]} */
  const splitValues = [];
  /** @type {Word[]} */
  const unreadFlags = [];
  /**
   * @param {string} name
   * @param {'value' | 'bool'} kind
   * @param {Word | undefined} value  undefined for a bare boolean flag
   */
  const record = (name, kind, value) => {
    uses.push({ name, kind, value });
    if (kind === 'value' && value?.splits) splitValues.push(value);
  };

  for (let i = 0; i < words.length; i++) {
    const word = /** @type {Word} */ (words[i]);
    const { text } = word;
    if (text === '--') {
      positional.push(...words.slice(i + 1));
      break;
    }
    if (text.startsWith('--')) {
      const eq = text.indexOf('=');
      const name = eq === -1 ? text : text.slice(0, eq);
      const glued = eq === -1 ? undefined : { ...word, text: text.slice(eq + 1) };
      if (valueFlags.has(name)) {
        record(name, 'value', glued ?? words[++i]);
        continue;
      }
      record(name, 'bool', glued);
      if (word.dynamic) unreadFlags.push(word);
    } else if (text.startsWith('-') && text.length > 1) {
      let tookValue = false;
      // gh's short flags are letters. Any other character may start an
      // expansion or a filename pattern (`$X`, `*`, `[=]`) that becomes
      // `=false`, so the flag before it gets that rest as an unknown value.
      for (let k = 1; k < text.length && /[a-zA-Z]/.test(text[k] ?? ''); k++) {
        const name = `-${text[k]}`;
        const next = text[k + 1];
        const rest = { ...word, text: text.slice(next === '=' ? k + 2 : k + 1) };
        if (valueFlags.has(name)) {
          record(name, 'value', rest.text === '' ? words[++i] : rest);
          tookValue = true;
          break;
        }
        if (next === '=') {
          record(name, 'bool', rest);
          break;
        }
        const unknown = next !== undefined && !/[a-zA-Z]/.test(next);
        record(name, 'bool', unknown ? { ...rest, dynamic: true } : undefined);
      }
      if (!tookValue && word.dynamic) unreadFlags.push(word);
    } else {
      positional.push(word);
    }
  }

  /** @param {string[]} aliases */
  const lastBool = (aliases) =>
    uses.filter(({ name, kind }) => kind === 'bool' && aliases.includes(name)).at(-1);
  /** @param {string[]} aliases */
  const has = (...aliases) => {
    const last = lastBool(aliases);
    if (!last) return false;
    return !last.value || (!last.value.dynamic && TRUE.test(last.value.text));
  };
  return {
    /** @param {string[]} aliases */
    values: (...aliases) =>
      uses.flatMap(({ name, kind, value }) =>
        kind === 'value' && value && aliases.includes(name) ? [value] : [],
      ),
    has,
    /** @param {string[]} aliases */
    maybe: (...aliases) => has(...aliases) || Boolean(lastBool(aliases)?.value?.dynamic),
    /** @param {string[]} aliases */
    named: (...aliases) => uses.some(({ name }) => aliases.includes(name)),
    help: has('-h', '--help'),
    positional,
    splitValues,
    unreadFlags,
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
