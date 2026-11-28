// @ts-check
// zsh glob qualifiers that run code, for the shell parser (#465).
//
// zsh reads a `(...)` at the end of a glob word as a list of qualifiers.
// Two of them run code: `e` followed by a delimited string (`e:...:`,
// `e[...]`, `e{...}`), which zsh runs as shell code, and `+name`, which calls
// the command `name`. `o` and `O` take either as a sort key (`oe:...:`,
// `o+name`). The shell expands the group before it reads the qualifiers, so
// `*($X)` may hold either. zsh's inline form `(#q...)` is not read here: the
// parser takes its `#` for a comment (#478).

// A qualifier list with either of the qualifiers that run code.
const RUNS_CODE = /[e+]/;

// The qualifiers that take no argument.
const PLAIN_QUALIFIERS = new Set('/.@=p*rwxAIERWXsStUGMTNDnF^-,');

// The number after a qualifier that takes one.
const TIME = /^[Mwhms]?[-+]?\d+/;
const SIZE = /^[kKmMpPgGtT]?[-+]?\d+/;
const SIGNED = /^[-+]?\d+/;
const DIGITS = /^\d+/;
const MODE = /^[=+-]?[0-7?]+/;

/**
 * The qualifiers that take an argument: a number that matches `number`, or,
 * where `string` is true, a delimited string (`u:root:`, `P:x:`).
 * @type {Record<string, { number: RegExp | null, string: boolean }>}
 */
const ARGUMENT_QUALIFIERS = {
  a: { number: TIME, string: false },
  m: { number: TIME, string: false },
  c: { number: TIME, string: false },
  L: { number: SIZE, string: false },
  l: { number: SIGNED, string: false },
  d: { number: DIGITS, string: false },
  Y: { number: DIGITS, string: false },
  u: { number: DIGITS, string: true },
  g: { number: DIGITS, string: true },
  f: { number: MODE, string: true },
  P: { number: null, string: true },
};

// The closing delimiter of a qualifier string that a bracket opens.
/** @type {Record<string, string>} */
const CLOSING_DELIMITERS = { '[': ']', '{': '}', '<': '>', '(': ')' };

/** The word before a `(` that makes it an array, as in `a=(1 2)` or `a+=(1)`. */
export const ARRAY_ASSIGNMENT = /^[A-Za-z_]\w*(\[[^\]]*\])?\+?=$/;

/** Commands whose `NAME=(...)` words are array assignments in zsh. */
export const ARRAY_DECLARERS = new Set([
  'local',
  'typeset',
  'declare',
  'export',
  'readonly',
  'integer',
  'float',
  'private',
]);

/**
 * Where the delimited string that starts at `text[at]` ends, read two ways,
 * since zsh nests some brackets and not others: up to the first closing
 * delimiter (`flat`), and up to the one that matches the opening (`nested`).
 * -1 when there is none.
 * @param {string} text
 * @param {number} at
 * @returns {{ flat: number, nested: number }}
 */
function delimitedEnd(text, at) {
  const open = text[at] ?? '';
  const close = CLOSING_DELIMITERS[open];
  if (close === undefined) {
    const end = text.indexOf(open, at + 1);
    return { flat: end, nested: end };
  }
  let nested = -1;
  for (let depth = 0, i = at + 1; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && depth-- === 0) {
      nested = i;
      break;
    }
  }
  return { flat: text.indexOf(close, at + 1), nested };
}

/**
 * The code a zsh glob qualifier list runs.
 * - `scripts`: the `e` strings, which zsh runs as shell code. When the reader
 *   cannot tell where one ends, it keeps each reading.
 * - `programs`: each command a `+name` calls.
 * - `unreadable`: the list has an `e` or `+` the reader cannot follow, so it
 *   may run code the reader did not find.
 * @param {string} text The list, with its quotes removed, as zsh reads it.
 * @returns {{ scripts: string[], programs: string[], unreadable: boolean }}
 */
export function globQualifierCode(text) {
  /** @type {string[]} */
  const scripts = [];
  /** @type {string[]} */
  const programs = [];
  const stop = () => ({ scripts, programs, unreadable: RUNS_CODE.test(text) });
  let i = 0;
  while (i < text.length) {
    const ch = text[i] ?? '';
    const argument = ARGUMENT_QUALIFIERS[ch];
    // Modifiers (`:h`, `:s/a/b/`) end the list and run no code.
    if (ch === ':') break;
    if (ch === 'e') {
      if (text[i + 1] === undefined) return stop();
      const { flat, nested } = delimitedEnd(text, i + 1);
      if (flat !== -1 && flat === nested) {
        scripts.push(text.slice(i + 2, flat));
        i = flat + 1;
        continue;
      }
      for (const end of new Set([flat, nested])) {
        scripts.push(text.slice(i + 2, end === -1 ? text.length : end));
      }
      return stop();
    }
    if (ch === '+') {
      const name = /^\w+/.exec(text.slice(i + 1))?.[0];
      if (name === undefined) return stop();
      programs.push(name);
      i += 1 + name.length;
    } else if (ch === 'o' || ch === 'O') {
      // A sort key: one letter, or an `e` string or `+name` read next.
      i += RUNS_CODE.test(text[i + 1] ?? '') ? 1 : 2;
    } else if (ch === '[') {
      const end = text.indexOf(']', i + 1);
      if (end === -1) return stop();
      i = end + 1;
    } else if (ch === '%') {
      // `%`, `%b` and `%c`: device files.
      i += /[bc]/.test(text[i + 1] ?? '') ? 2 : 1;
    } else if (PLAIN_QUALIFIERS.has(ch)) {
      i++;
    } else if (argument) {
      const number = argument.number?.exec(text.slice(i + 1))?.[0];
      if (number !== undefined) {
        i += 1 + number.length;
        continue;
      }
      if (!argument.string) return stop();
      const { flat, nested } = delimitedEnd(text, i + 1);
      if (flat === -1 || flat !== nested) return stop();
      i = flat + 1;
    } else {
      return stop();
    }
  }
  return { scripts, programs, unreadable: false };
}
