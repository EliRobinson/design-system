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

// Runs of characters readGlobGroupText copies as they are: inside single
// quotes, and elsewhere.
const SINGLE_QUOTED_RUN = /[^']+/y;
const PLAIN_RUN = /[^\\'"$`{]+/y;

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
 * It reads each character once.
 * @param {string} raw The source between the group's parentheses.
 * @returns {{ text: string, dynamic: boolean }}
 */
export function readGlobGroupText(raw) {
  let text = '';
  let dynamic = false;
  /** @type {"'" | '"' | null} */
  let quote = null;
  // The next `{` and `}` past the one being read, found once each.
  let nextOpen = -1;
  let nextClose = -1;
  const after = (/** @type {string} */ ch, /** @type {number} */ at) => {
    const found = raw.indexOf(ch, at);
    return found === -1 ? Infinity : found;
  };
  for (let i = 0; i < raw.length; i++) {
    const run = quote === "'" ? SINGLE_QUOTED_RUN : PLAIN_RUN;
    run.lastIndex = i;
    const plain = run.exec(raw)?.[0];
    if (plain !== undefined) {
      text += plain;
      i += plain.length - 1;
      continue;
    }
    const ch = raw[i] ?? '';
    const next = raw[i + 1] ?? '';
    // The run above copies the rest: only a `'` ends up here in single quotes.
    if (quote === "'") {
      quote = null;
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
      if (quote === null && ch === '$' && QUOTE_START.test(next)) dynamic = true;
      if (quote === null && ch === '{') {
        // A brace expansion holds no other brace, so only the last `{`
        // before a `}` may start one: test the span to that `}`.
        if (nextOpen <= i) nextOpen = after('{', i + 1);
        if (nextClose < i) nextClose = after('}', i);
        const span = nextClose < nextOpen ? raw.slice(i, nextClose + 1) : '';
        if (BRACE_EXPANSION.test(span.replace(/['"]/g, ''))) dynamic = true;
      }
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
 * A closed glob group: its code, and the scope that code runs in.
 * @typedef {{ code: GlobCode, at: number[] }} ClosedGlobGroup
 */

/**
 * Keeps one level's glob groups, from `(` to `)`, and hands each closed one
 * to `read` once. zsh reads a glob group that holds a `(` as a pattern, so
 * an inner group's code runs only from an `e` string of a group around it,
 * which its `eval` reads again, or when the group around it is a list or a
 * subshell (`for f (...)`, `repeat 1 (...)`), which runs it in the shell
 * around that group. So a closed group inside an open glob group is kept
 * until the open one closes or ends; see `close`.
 * @param {string} script
 * @param {number[]} groups The level's open groups, innermost last.
 * @param {(group: ClosedGlobGroup) => void} read
 */
export function globGroupTracker(script, groups, read) {
  /** @type {Map<number, { start: number, standalone: boolean, inner: ClosedGlobGroup[] }>} */
  const open = new Map();
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
    /** How many glob groups are open. */
    get depth() {
      return open.size;
    },
    /** @param {number} id */
    isOpen: (id) => open.has(id),
    /** Whether `id` is an open standalone glob group. @param {number | undefined} id */
    isStandalone: (id) => id !== undefined && open.get(id)?.standalone === true,
    /**
     * A glob group opens at `start`. `standalone`: its `(` stands alone, so
     * it may be a list or a subshell.
     * @param {number} id
     * @param {number} start
     * @param {boolean} standalone
     */
    open(id, start, standalone) {
      open.set(id, { start, standalone, inner: [] });
    },
    /**
     * The open glob group `id`, already out of the level's groups, closes at
     * its `)` at `end`. Its code runs in `at`.
     * @param {number} id
     * @param {number} end
     * @param {number[]} at
     */
    close(id, end, at) {
      // The parser asks isOpen first, so no input reaches this throw. It
      // would let the hook allow the call (#479).
      const entry = open.get(id);
      if (!entry) throw new Error(`glob group ${id} is not open`);
      open.delete(id);
      const { text, dynamic } = readGlobGroupText(script.slice(entry.start + 1, end));
      const code = { text, dynamic, ...globQualifierCode(text) };
      // With an `e` string, its eval reads the inner groups again. Without
      // one, the inner groups run in the shell around this group, so they are
      // read here, under its scope. So are they in a group that may be a list
      // or a subshell, whose own `e` strings never run then.
      const mayRunInner = entry.standalone && entry.inner.length > 0;
      const ownScripts = mayRunInner ? [] : code.scripts;
      const runsInner = mayRunInner || code.scripts.length === 0;
      if (runsInner) {
        for (const group of entry.inner) group.at = at;
        file(entry.inner);
      }
      file([{ code: { ...code, scripts: ownScripts }, at }]);
    },
    /** The open glob group `id`, already out of the level's groups, ends without its `)`. @param {number} id */
    drop(id) {
      // As in `close`, the parser asks isOpen first.
      const entry = open.get(id);
      if (!entry) throw new Error(`glob group ${id} is not open`);
      open.delete(id);
      file(entry.inner);
    },
    /** The level ends: every open glob group ends without its `)`. */
    dropAll() {
      for (const entry of open.values()) for (const group of entry.inner) read(group);
      open.clear();
    },
  };
}
