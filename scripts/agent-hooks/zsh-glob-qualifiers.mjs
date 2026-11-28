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

import { BRACE_EXPANSION, EXPANSION_START, QUOTE_START } from './shell-lexemes.mjs';

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

/**
 * The text of a glob group as zsh reads its qualifiers: its quotes removed.
 * `dynamic`: an expansion the shell runs first (`$X`, `"$X"`, `$(...)`,
 * backticks, `$'...'`, a brace expansion, quoted parts and all, as in
 * `{'d'..f}`) builds part of it at run time, so it may hold any qualifier.
 * @param {string} raw The source between the group's parentheses.
 * @returns {{ text: string, dynamic: boolean }}
 */
export function readGlobGroupText(raw) {
  let text = '';
  let dynamic = false;
  /** @type {"'" | '"' | null} */
  let quote = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] ?? '';
    const next = raw[i + 1] ?? '';
    if (quote === "'") {
      if (ch === "'") quote = null;
      else text += ch;
    } else if (ch === '\\') {
      // In double quotes a backslash escapes only these; it stays before others.
      if (quote === '"' && !/[$`"\\\n]/.test(next)) text += ch;
      if (next !== '\n') text += next;
      i++;
    } else if (quote === null && (ch === "'" || ch === '"')) {
      quote = ch;
    } else if (quote === '"' && ch === '"') {
      quote = null;
    } else {
      const expansion = ch === '$' && (EXPANSION_START.test(next) || next === '(');
      if (ch === '`' || expansion) dynamic = true;
      // `$'...'` and `$"..."`, outside double quotes.
      if (quote === null && ch === '$' && QUOTE_START.test(next)) dynamic = true;
      const unquoted = raw.slice(i).replace(/['"]/g, '');
      if (quote === null && ch === '{' && BRACE_EXPANSION.test(unquoted)) dynamic = true;
      text += ch;
    }
  }
  return { text, dynamic };
}

/**
 * What a glob group's qualifiers run (see globQualifierCode), with its text
 * and whether an expansion builds part of it (see readGlobGroupText).
 * @typedef {{ text: string, dynamic: boolean, scripts: string[], programs: string[], unreadable: boolean }} GlobCode
 */

/**
 * @param {string} raw The source between the group's parentheses.
 * @returns {GlobCode}
 */
export function globGroupCode(raw) {
  const { text, dynamic } = readGlobGroupText(raw);
  return { text, dynamic, ...globQualifierCode(text) };
}

/**
 * A closed glob group: its code, and the scope that code runs in.
 * @typedef {{ code: GlobCode, at: number[] }} ClosedGlobGroup
 */

/**
 * Keeps one level's glob groups, from `(` to `)`, and hands each closed one
 * to `read` once. zsh runs an inner group's code only from an `e` string of
 * a group around it, whose `eval` reads the inner group again. So a closed
 * group inside an open glob group is kept, and dropped when the outer group
 * closes with an `e` string to read. If the outer group has none (it is a
 * pattern, a subshell, or a `for` list), or never closes at its `)` (a `}`
 * read as a closer, the end of the level), the kept groups are read anyway.
 * @param {string} script
 * @param {number[]} groups The level's open groups, innermost last.
 * @param {(group: ClosedGlobGroup) => void} read
 */
export function globGroupTracker(script, groups, read) {
  /** @type {Map<number, { start: number, inner: ClosedGlobGroup[] }>} */
  const open = new Map();
  let justClosed = false;
  // The innermost open glob group, if any.
  const outer = () => {
    for (let i = groups.length - 1; i >= 0; i--) {
      const entry = open.get(groups[i] ?? 0);
      if (entry) return entry;
    }
    return undefined;
  };
  // Keeps closed groups for the glob group around them, or reads them.
  const file = (/** @type {ClosedGlobGroup[]} */ closed) => {
    const around = outer();
    for (const group of closed) {
      if (around) around.inner.push(group);
      else read(group);
    }
  };
  return {
    /** A glob group opens at `start`. @param {number} id @param {number} start */
    open(id, start) {
      open.set(id, { start, inner: [] });
    },
    /**
     * The group `id`, already out of `groups`, closes at its `)` at `end`.
     * @param {number} id
     * @param {number} end
     * @param {() => number[]} atOf The scope its code runs in.
     */
    close(id, end, atOf) {
      const entry = open.get(id);
      justClosed = entry !== undefined;
      if (!entry) return;
      open.delete(id);
      const code = globGroupCode(script.slice(entry.start + 1, end));
      const at = atOf();
      // With an `e` string, the group is read again by its `eval`, inner
      // groups and all. zsh reads a glob group that holds a `(` as a pattern,
      // so its inner groups' code never runs from it; only from a subshell or
      // a list (`for f (...)`), which has no `e` string and runs the inner
      // code in the shell around it.
      if (code.scripts.length === 0) file(entry.inner.map((group) => ({ ...group, at })));
      file([{ code, at }]);
    },
    /** The group `id`, already out of `groups`, ends without its `)`. @param {number} id */
    drop(id) {
      const entry = open.get(id);
      if (!entry) return;
      open.delete(id);
      file(entry.inner);
    },
    /** The level ends: every open glob group ends without its `)`. */
    dropAll() {
      for (const entry of open.values()) for (const group of entry.inner) read(group);
      open.clear();
    },
    /** Whether the last character read closed a glob group. Resets it. */
    takeClosed() {
      const was = justClosed;
      justClosed = false;
      return was;
    },
  };
}
