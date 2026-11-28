// @ts-check
// A small shell parser for the review gate hook. It is not a full shell: it
// finds every simple command in a script, including ones inside `$(...)`,
// backticks, `bash -c`, `eval`, and `coproc`, and ignores text inside quotes,
// comments, heredoc bodies, and `((...))`. See docs/agents/git-and-prs.md
// for what it does not catch.

import { posix } from 'node:path';

import { BRACE_EXPANSION, EXPANSION_START, QUOTE_START } from './shell-lexemes.mjs';
import { globGroupTracker } from './zsh-glob-qualifiers.mjs';

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
 * - `async` is true when it runs in a coprocess (`coproc`) or a background
 *   job (`&`), which the shell starts and does not wait for, so what it makes
 *   may not exist yet when the next command runs. It is derived from `scope`.
 * - `marks` has one entry per `argv` word: whether the shell builds it at run
 *   time, and whether it may split into more words.
 * - `origin` is `'glob'` for the `eval` of a zsh glob qualifier's `e` string.
 * @typedef {{ argv: string[], env: string[], scope: number[], top: boolean, async: boolean, marks: WordMark[], origin?: 'glob' }} Command
 */

/**
 * How the shell builds a word.
 * - `dynamic`: some of it comes from an expansion (`$X`, `$(...)`, backticks,
 *   `$'...'`), a brace expansion, or an unquoted filename pattern, so the text
 *   the parser keeps is not what runs.
 * - `splits`: whether the word may become several words, a flag among them.
 *   `'unquoted'`: an expansion, a brace expansion (`{a,b}`) or a filename
 *   pattern is unquoted, so double quotes would stop the split. `'always'`:
 *   an expansion splits even in double quotes (`"$@"`, `"${a[@]}"`, zsh's
 *   `"${=x}"`). `false`: it does not split.
 *
 * A filename pattern is any of these, unquoted: a `*` or `?`; a `[` closed
 * by a later `]` in the word, quoted or not (`[ab]`, `[" "b]`; a lone `[` or
 * `[[` is not one); a word with a `(` glued to it (zsh's `a(b|c)`, bash's
 * extglob `@(b)`); or, past where a command starts, a `(` that stands alone
 * (zsh's `(a|b)`, kept as the word `(...)`). It is `dynamic` and splits
 * `'unquoted'`: a file named `--admin` turns `--admi[n]`, `--admi(n)` or `*`
 * into that flag.
 * @typedef {{ dynamic: boolean, splits: false | 'unquoted' | 'always' }} WordMark
 */

/** A word with its text and how the shell builds it. @typedef {WordMark & { text: string }} Word */

/**
 * A command's words, each `argv` entry with its mark.
 * @param {Command} command
 * @returns {Word[]}
 */
export function wordsOf(command) {
  return command.argv.map((text, i) => ({
    text,
    .../** @type {WordMark} */ (command.marks[i]),
  }));
}

// After a `$` inside double quotes: the expansions that still split.
const SPLITS_IN_QUOTES = /^\$(@|\{[=(]|\{[^}]*\[[@*]\]|\w+\[[@*]\])/;
// The word kept for a `(` that stands alone past where a command starts,
// which zsh may read as a glob group (see WordMark).
const GLOB_GROUP_WORD = '(...)';
// The mark of a word the shell does not build at run time.
const PLAIN_MARK = /** @type {WordMark} */ (Object.freeze({ dynamic: false, splits: false }));
// The mark of a word built at run time that may split, such as `$X`.
const RUN_TIME_MARK = /** @type {WordMark} */ (
  Object.freeze({ dynamic: true, splits: 'unquoted' })
);
// How deep `eval` and `bash -c` scripts are read.
const MAX_EVAL_DEPTH = 5;
// How many commands reading glob qualifiers' `e` strings may add to one
// parse (#465). Past it, or past MAX_EVAL_DEPTH, an `e` string counts as a
// command built at run time.
const GLOB_WORK_LIMIT = 10000;

/**
 * Whether a `(` glued to `word` opens an array, as in `a=(1 2)`: in an
 * assignment's place, or after a command that declares one (`local a=(1)`).
 * @param {string} word
 * @param {string[]} argv The words before it.
 */
function isArrayAssignment(word, argv) {
  return (
    ARRAY_ASSIGNMENT.test(word) &&
    (argv.every((each) => ASSIGNMENT.test(each)) || ARRAY_DECLARERS.has(argv[0] ?? ''))
  );
}

/**
 * Whether a `(` may open a zsh glob group, whose qualifiers may run code: one
 * glued to a word that is not an array assignment, one that stands alone
 * past where a command starts, or one right after a glob group's `)`, as in
 * `(a|b)(e:...:)`. `f()` is a function name.
 * @param {{ next: string | undefined, word: string | null, argv: string[], standalone: boolean, afterGlobGroup: boolean }} at
 */
function opensGlobGroup({ next, word, argv, standalone, afterGlobGroup }) {
  if (next === ')') return false;
  if (word !== null) return !isArrayAssignment(word, argv);
  return standalone || afterGlobGroup;
}

/**
 * A command built at run time, one word long.
 * @param {string} word
 * @param {number[]} scope
 */
const runTimeCommand = (word, scope) => makeCommand([word], scope, [RUN_TIME_MARK]);

/**
 * The words at the front of a command that the shell reads as keywords
 * (`if`, `!`, `{`) or compound openers (`while`, `for`, `case`), up to the
 * first word that is not one. The word after them starts the command.
 * @param {string[]} argv
 */
function leadingKeywords(argv) {
  const end = argv.findIndex((each) => !COMPOUND_OPENERS.has(each) && !KEYWORDS.has(each));
  return end === -1 ? argv : argv.slice(0, end);
}

/**
 * How a `coproc` runs its command.
 * - `compound`: a compound body starts at word `at`, which readLevel opens.
 * - `simple`: a simple command starts at word `at`.
 * - `subshell`: a `(` comes right after `coproc [NAME]`, and the group it
 *   opens is the coprocess.
 * @typedef {{ form: 'compound' | 'simple', at: number } | { form: 'subshell' }} CoprocForm
 */

/**
 * The forms whose command comes in the same words as the `coproc`, so it
 * gets a shell of its own there.
 * @typedef {Exclude<CoprocForm, { form: 'subshell' }>} ShellForm
 */

/**
 * A `coproc` readLevel reads: its form, with `id`, the coprocess's shell,
 * for a ShellForm.
 * @typedef {(ShellForm & { id: number }) | Extract<CoprocForm, { form: 'subshell' }>} Coproc
 */

/**
 * Whether a `coproc` runs its command in the same words, in a shell of its own.
 * @template {{ form: string }} T
 * @param {T | null} coproc
 * @returns {coproc is Exclude<T, { form: 'subshell' }>}
 */
function hasShell(coproc) {
  return coproc !== null && coproc.form !== 'subshell';
}

/**
 * How a `coproc` at the front of `argv` (past keywords, assignments and
 * wrappers) runs its command, or null when `argv` is not one. bash reads
 * `coproc NAME compound` when the word after NAME opens a compound command,
 * and `coproc command` otherwise; zsh reads only the forms with no NAME.
 * `beforeSubshell`: a `(` comes right after these words.
 * @param {string[]} argv
 * @param {{ beforeSubshell: boolean }} options
 * @returns {CoprocForm | null}
 */
function coprocOf(argv, { beforeSubshell }) {
  if (argv[0] !== 'coproc') return null;
  const name = argv[1] ?? '';
  if (COMPOUND_OPENERS.has(name)) return { form: 'compound', at: 1 };
  if (!KEYWORDS.has(name) && COMPOUND_OPENERS.has(argv[2] ?? ''))
    return { form: 'compound', at: 2 };
  const rest = argv.at(-1) === GLOB_GROUP_WORD ? argv.slice(1, -1) : argv.slice(1);
  if (beforeSubshell && rest.length <= 1) return { form: 'subshell' };
  return rest.length === 0 ? null : { form: 'simple', at: 1 };
}

/**
 * What one parse keeps across its levels. `last` hands out scope ids, unique
 * within the parse; `async` keeps the ids of the shells the line does not
 * wait for: coprocesses and background jobs. `globWork` counts the commands
 * read from glob qualifiers' `e` strings.
 * @typedef {{ last: number, async: Set<number>, globWork: number }} ParseState
 */

/**
 * A command at `scope`, before parseCommands sets `top` and `async`.
 * @param {string[]} argv
 * @param {number[]} scope
 * @param {WordMark[]} marks
 * @param {string[]} [env]
 * @returns {Command}
 */
function makeCommand(argv, scope, marks, env = []) {
  return { argv, env, scope, top: false, async: false, marks };
}

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
 * @param {ParseState} state
 * @returns {{ commands: Command[], end: number }}
 */
function readLevel(script, start, closer, scope, state) {
  const newScope = () => ++state.last;
  /** @type {Command[]} */
  const commands = [];
  /** @type {number[]} The open `(...)` groups and compound bodies. */
  const groups = [];
  // Where the current and-or list starts in `commands`. `a && b & c` sends
  // all of `a && b` to the background, not only `b`. Each group has its own:
  // a `;` inside `(a; b) & c` ends a list in the group, and the `&` after it
  // sends the whole group to the background.
  let listStart = 0;
  /** @type {number[]} The list start outside each `groups` entry, for when it closes. */
  const listStarts = [];
  const openGroup = (/** @type {number} */ id) => {
    groups.push(id);
    listStarts.push(listStart);
  };
  // Closes the last `count` groups and goes back to the list they were in.
  const closeGroups = (/** @type {number} */ count) => {
    const closed = groups.splice(-count);
    const outer = listStarts.splice(-count)[0];
    if (outer !== undefined) listStart = outer;
    return closed;
  };
  /** @type {Array<{ delimiter: string, dash: boolean }>} */
  const heredocs = [];
  /** @type {string[]} */
  let argv = [];
  /** @type {WordMark[]} One per `argv` word. */
  let marks = [];
  /** @type {string | null} */
  let word = null;
  /** @type {WordMark} The word being read. */
  let mark = PLAIN_MARK;
  let redirectTarget = false;
  // Whether the command being read takes its stdin from a pipe.
  let pipedIn = false;
  // Whether the word being read has an unquoted `[`, which a later `]` makes
  // a filename pattern (see WordMark).
  let bracketOpen = false;
  // Adds the code a closed glob group's qualifiers run (see
  // globGroupTracker). zsh runs it in the shell that expands the word, for
  // each file the pattern matches, so it may not run at all: it goes in a
  // compound body there (`at`), and a `cd` in it leaves the folder unknown.
  // An `e` string is read as an `eval` script; code the parser cannot read is
  // a command built at run time.
  const glob = globGroupTracker(script, groups, ({ code, at }) => {
    for (const each of code.scripts) {
      commands.push({
        ...makeCommand(['eval', each], at, [PLAIN_MARK, PLAIN_MARK]),
        origin: 'glob',
      });
    }
    for (const each of code.programs) commands.push(runTimeCommand(each, at));
    if (code.unreadable || code.dynamic) commands.push(runTimeCommand(code.text, at));
  });

  // Adds text to the word being read. Side effect: a `]` in it after an
  // unquoted `[` marks the word a filename pattern (see WordMark).
  const append = (/** @type {string} */ text) => {
    if (bracketOpen && text.includes(']')) expands('unquoted');
    word = (word ?? '') + text;
  };
  // The word being read has an expansion. `splits`: it may split into words.
  const expands = (/** @type {WordMark['splits']} */ splits) => {
    mark = { dynamic: true, splits: mark.splits === 'always' ? 'always' : splits || mark.splits };
  };
  const pushWord = (/** @type {string} */ text, /** @type {WordMark} */ wordMark) => {
    argv.push(text);
    marks.push(wordMark);
  };
  const endWord = () => {
    if (word === null) return;
    if (redirectTarget) redirectTarget = false;
    else pushWord(word, mark);
    word = null;
    mark = PLAIN_MARK;
    bracketOpen = false;
  };
  const here = () => [...scope, ...groups];
  /** @type {number[]} How many `groups` entries each open compound body holds. */
  const compoundSizes = [];
  // Where the substitutions read in the current command's words start in
  // `commands`.
  let commandStart = 0;
  // A shell id the line does not wait for, kept in `state.async`.
  const newAsyncScope = () => {
    const id = newScope();
    state.async.add(id);
    return id;
  };
  // Puts `id` into the scope of each command, at depth `at`.
  const wrapScopes = (
    /** @type {Command[]} */ list,
    /** @type {number} */ at,
    /** @type {number} */ id,
  ) => {
    for (const each of list) each.scope = [...each.scope.slice(0, at), id, ...each.scope.slice(at)];
  };
  // Opens or closes a compound body at the front of the command's words.
  // Returns whether it opened one. A body that reads from a pipe runs, whole,
  // in that pipe stage's subshell, so the stage's scope goes around it. So
  // does a `coproc`'s compound body, in the coprocess's shell: the closer that
  // ends the body pops both. `front`: the words past what `unwrap` drops,
  // where `coproc` reads its command.
  const trackCompound = (/** @type {string[]} */ front, /** @type {Coproc | null} */ coproc) => {
    if (COMPOUND_CLOSERS.has(argv[0] ?? '')) {
      for (const id of closeGroups(compoundSizes.pop() ?? 1)) glob.drop(id);
    }
    let opened = false;
    const open = (/** @type {number | null} */ subshell) => {
      if (subshell !== null) openGroup(subshell);
      openGroup(-newScope());
      compoundSizes.push(subshell === null ? 1 : 2);
      opened = true;
    };
    for (const word of leadingKeywords(argv)) {
      if (COMPOUND_OPENERS.has(word)) open(pipedIn && !opened ? newScope() : null);
    }
    if (coproc?.form !== 'compound') return opened;
    leadingKeywords(front.slice(coproc.at)).forEach((word, i) => {
      if (i === 0) open(coproc.id);
      else if (COMPOUND_OPENERS.has(word)) open(null);
    });
    return opened;
  };
  // A `coproc`'s form with a new shell for it, when its command comes in the
  // same words.
  const withShell = (/** @type {CoprocForm | null} */ form) =>
    hasShell(form) ? { ...form, id: newAsyncScope() } : form;
  // Adds the command in `words`, past what `unwrap` drops. For a `coproc`,
  // the record of the `coproc` itself and the command it runs both go in the
  // coprocess's shell, so the hook reads both. A compound body is in it
  // already: trackCompound opened it. For `coproc [NAME] ( ... )` the record
  // stays outside, since only the group that follows runs in the coprocess.
  // A `coproc` inside a simple form (`coproc coproc x`) gets a shell of its
  // own.
  const pushCommand = (
    /** @type {string[]} */ words,
    /** @type {WordMark[]} */ wordMarks,
    /** @type {number[]} */ commandScope,
    /** @type {Coproc | null} */ coproc,
  ) => {
    const { argv: command, env } = unwrap(words);
    // `unwrap` drops words only from the front.
    const commandMarks = wordMarks.slice(words.length - command.length);
    const inCoproc = coproc?.form === 'simple' ? [...commandScope, coproc.id] : commandScope;
    // A bare `NAME=value` is kept: it sets a variable in the current shell.
    if (command.length > 0 || env.length > 0) {
      commands.push(makeCommand(command, inCoproc, commandMarks, env));
    }
    if (!hasShell(coproc)) return;
    const inner = command.slice(coproc.at);
    const nested = coprocOf(unwrap(inner).argv, { beforeSubshell: false });
    pushCommand(inner, commandMarks.slice(coproc.at), inCoproc, withShell(nested));
  };
  // `op` is the operator that ends the command, if any. Each stage of a
  // pipeline runs in a subshell, and so does an and-or list sent to the
  // background. `beforeSubshell`: a `(` ends it. Returns how a `coproc` at its
  // front runs (see coprocOf), for the `(` that follows.
  const endCommand = (/** @type {string | null} */ op = null, { beforeSubshell = false } = {}) => {
    endWord();
    const depth = here().length;
    const front = unwrap(argv).argv;
    const coproc = withShell(coprocOf(front, { beforeSubshell }));
    const opened = trackCompound(front, coproc);
    const piped = op === '|' || op === '|&';
    const own = (pipedIn && !opened) || piped ? [...here(), newScope()] : here();
    const substitutionsEnd = commands.length;
    pushCommand(argv, marks, own, coproc);
    // A substitution in a coproc's words runs in the coprocess too.
    if (hasShell(coproc))
      wrapScopes(commands.slice(commandStart, substitutionsEnd), depth, coproc.id);
    if (op === '&') {
      const prefix = here();
      // Only the list in this group goes to the background, not one that a
      // `(` or `{` around this point started.
      const list = commands
        .slice(listStart)
        .filter((each) => prefix.every((scopeId, i) => each.scope[i] === scopeId));
      wrapScopes(list, prefix.length, newAsyncScope());
    }
    if (op !== null && LIST_ENDS.has(op)) listStart = commands.length;
    argv = [];
    marks = [];
    pipedIn = piped;
    commandStart = commands.length;
    return coproc;
  };
  // Reads a nested script and keeps its source text in the current word.
  const readNested = (/** @type {number} */ from, /** @type {')' | '`'} */ close) => {
    const level = readLevel(script, from, close, [...here(), newScope()], state);
    // A loop, not a spread: a spread of a long list overflows the stack.
    for (const command of level.commands) commands.push(command);
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
    const afterGlobGroup = glob.takeClosed();
    const arithmetic =
      (ch === '$' && next === '(' && script[i + 2] === '(') ||
      (ch === '(' && next === '(' && word === null);

    if (closer === '`' && ch === '`') {
      endCommand();
      glob.dropAll();
      return { commands, end: i + 1 };
    }
    if (ch === ')') {
      // End the command first: a `}` or `done` in it closes its body, and
      // with it a `coproc`'s subshell, before this `)` closes the `$(`.
      endCommand();
      if (closer === ')' && groups.length === 0) return { commands, end: i + 1 };
      const [closing = 0] = closeGroups(1);
      // A coprocess's group runs its glob code in the coprocess.
      const inGroup = state.async.has(closing) ? [closing] : [];
      glob.close(closing, i, () => [...here(), ...inGroup, -newScope()]);
      i++;
      continue;
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
          expands(false);
          i = skipArithmetic(i, 3);
        } else if (inner === '$' && script[i + 1] === '(') {
          expands(false);
          i = readNested(i + 2, ')');
        } else if (inner === '`') {
          expands(false);
          i = readNested(i + 1, '`');
        } else if (inner === '$' && EXPANSION_START.test(script[i + 1] ?? '')) {
          expands(SPLITS_IN_QUOTES.test(script.slice(i)) ? 'always' : false);
          append(inner);
          i++;
        } else {
          append(inner ?? '');
          i++;
        }
      }
      i++;
    } else if (arithmetic) {
      if (ch === '$') expands('unquoted');
      i = skipArithmetic(i, ch === '$' ? 3 : 2);
    } else if (ch === '$' && next === '(') {
      expands('unquoted');
      i = readNested(i + 2, ')');
    } else if (ch === '`') {
      expands('unquoted');
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
      // A `(` glued to a word may be a glob group in it (`--admi(n|x)`, see
      // WordMark) or a subshell (`time(...)`, `time -p(...)`, `case x in(x)`).
      // So may a `(` that stands alone past where a command starts, a word of
      // its own in zsh (`gh pr merge 5 (--admin|x)`); it is kept as a `(...)`
      // word. Read both: mark the word, then read the group as a subshell, so
      // no command in it is missed. `f()` is a function name. Either may also
      // hold zsh glob qualifiers that run code, read when the group closes;
      // so may a `(` right after a glob group's `)`. `a=(...)` in an
      // assignment's place is an array.
      const standalone =
        word === null && !redirectTarget && leadingKeywords(argv).length < argv.length;
      const opensGlob = opensGlobGroup({ next, word, argv, standalone, afterGlobGroup });
      if (opensGlob && word !== null) expands('unquoted');
      else if (opensGlob && standalone) pushWord(GLOB_GROUP_WORD, RUN_TIME_MARK);
      // After any `coproc`, the group runs in a coprocess: it is the
      // coprocess in `coproc ( ... )` and `coproc NAME ( ... )`, inside one in
      // `coproc { (...); }`, and in `coproc x a(...)`, which zsh may read as a
      // glob group, it is read as one to be safe.
      const coproc = endCommand(null, { beforeSubshell: true });
      const id = coproc === null ? newScope() : newAsyncScope();
      openGroup(id);
      if (opensGlob) glob.open(id, i);
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
        // `$'...'` and `$"..."` are read as quotes, but their text is not
        // what runs, so they count as built at run time; they do not split.
        if (ch === '$' && EXPANSION_START.test(next ?? '')) expands('unquoted');
        else if (ch === '$' && QUOTE_START.test(next ?? '')) expands(false);
        else if (ch === '{' && BRACE_EXPANSION.test(script.slice(i))) expands('unquoted');
        else if (ch === '*' || ch === '?') expands('unquoted');
        append(ch);
        if (ch === '[') bracketOpen = true;
        i++;
      }
    }
  }
  endCommand();
  glob.dropAll();
  return { commands, end: script.length };
}

const KEYWORDS = new Set([
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
export const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const ASSIGNMENT = /^[A-Za-z_]\w*=/;
// The word before a `(` that makes it an array, as in `a=(1 2)` or `a+=(1)`.
const ARRAY_ASSIGNMENT = /^[A-Za-z_]\w*(\[[^\]]*\])?\+?=$/;
// Commands whose `NAME=(...)` words are array assignments in zsh.
const ARRAY_DECLARERS = new Set([
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
 * @param {ParseState} [state]
 * @returns {Command[]}
 */
export function parseCommands(
  script,
  depth = 0,
  scope = [],
  state = { last: 0, async: new Set(), globWork: 0 },
) {
  if (depth > MAX_EVAL_DEPTH) return [];
  /** @type {Command[]} */
  const all = [];
  // A loop, not a spread: a spread of a long list overflows the stack.
  const add = (/** @type {Command[]} */ list) => {
    for (const command of list) all.push(command);
  };
  for (const command of readLevel(script, 0, null, scope, state).commands) {
    all.push(command);
    const { argv } = command;
    const shellScript = shellScriptOf(argv);
    if (shellScript !== null) {
      add(parseCommands(shellScript, depth + 1, [...command.scope, ++state.last], state));
    } else if (argv[0] === 'eval') {
      // A glob qualifier's `e` string past the depth or the work it may take
      // is a command built at run time.
      const fromGlob = command.origin === 'glob';
      const capped = fromGlob && (depth >= MAX_EVAL_DEPTH || state.globWork >= GLOB_WORK_LIMIT);
      const text = argv.slice(1).join(' ');
      const inner = capped
        ? [runTimeCommand(text, command.scope)]
        : parseCommands(text, depth + 1, command.scope, state);
      if (fromGlob) state.globWork += inner.length;
      add(inner);
    }
  }
  for (const command of all) {
    command.top = command.scope.length === 0;
    command.async = command.scope.some((id) => state.async.has(id));
  }
  return all;
}

/**
 * The shell a scope runs in: its subshell ids, without the compound bodies
 * (negative ids), which run in the shell around them. Two commands whose
 * `shellOf` scopes are equal may share variables and a folder.
 * @param {number[]} scope
 * @returns {number[]}
 */
function shellOf(scope) {
  return scope.filter((id) => id > 0);
}

// `cd` flags that change how a link is followed, not where it goes.
const CD_FLAGS = new Set(['-L', '-P', '-e', '-@']);

/**
 * The target word of a `cd` or `pushd`, past its link flags and `--`.
 * @param {string[]} argv
 * @returns {string | undefined}
 */
export function cdWord(argv) {
  let i = 1;
  while (CD_FLAGS.has(argv[i] ?? '')) i++;
  if (argv[i] === '--') i++;
  return argv[i];
}

/**
 * Whether a path does not depend on the folder a command runs in: it starts
 * with `/`. A `~` path is relative here: the shell does not expand `~` after
 * `=@` (`-F query=@~/q.graphql`) or in quotes (`--input "~/q.json"`), so gh
 * reads it from the folder the command runs in.
 * @param {string} path
 */
export function isAbsolutePath(path) {
  return path.startsWith('/');
}

/**
 * The folder `cd <target>` (or `pushd <target>`) moves to from `dir`, or
 * null when a parser cannot tell: no target, `-`, a flag, a leading `~`, or
 * anything built at run time (`$`, backticks). A null `dir` stays null. A
 * relative `dir` gives a relative folder, as a hook's working directory does.
 * @param {string | null} dir
 * @param {string | undefined} target
 * @returns {string | null}
 */
export function cdTarget(dir, target) {
  // A `~` target was ruled out here: the parser does not know the home folder.
  if (dir === null || target === undefined || /^[-~]|[$`]/.test(target)) return null;
  const folder = isAbsolutePath(target) ? posix.normalize(target) : posix.join(dir, target);
  // `join` and `normalize` keep a trailing slash; a folder is the same one without it.
  return folder.replace(/(.)\/$/, '$1');
}

/**
 * The args after any leading flags, skipping the values of `valueFlags`.
 * Args are strings, or words read through `textOf`.
 * @template T
 * @param {T[]} args
 * @param {Set<string>} valueFlags
 * @param {(arg: T) => string} [textOf]
 * @returns {T[]}
 */
export function afterFlags(args, valueFlags, textOf = String) {
  const text = (/** @type {number} */ i) =>
    i < args.length ? textOf(/** @type {T} */ (args[i])) : '';
  let i = 0;
  while (text(i).startsWith('-')) i += valueFlags.has(text(i)) ? 2 : 1;
  return args.slice(i);
}

/** `gh` flags that take a value and may come before its command. */
export const GH_VALUE_FLAGS = new Set(['-R', '--repo']);

/**
 * The parts of a `gh` command: `group` is the first word past gh's own
 * flags, `rest` the args after it, and `sub` and `subArgs` the same walk
 * once more, as in `gh pr create ...`. Null when it is not `gh` or has no
 * group. Args are strings, or words read through `textOf`.
 * @template T
 * @param {T[]} argv
 * @param {(arg: T) => string} [textOf]
 * @returns {{ group: T, rest: T[], sub: T | undefined, subArgs: T[] } | null}
 */
export function ghCommand(argv, textOf = String) {
  if (argv.length === 0 || posix.basename(textOf(/** @type {T} */ (argv[0]))) !== 'gh') return null;
  const [group, ...rest] = afterFlags(argv.slice(1), GH_VALUE_FLAGS, textOf);
  if (group === undefined) return null;
  const [sub, ...subArgs] = afterFlags(rest, GH_VALUE_FLAGS, textOf);
  return { group, rest, sub, subArgs };
}

/** @param {number[]} scope */
const keyOf = (scope) => scope.join('/');

/**
 * Whether `outer` is `inner` or a shell around it.
 * @param {number[]} outer
 * @param {number[]} inner
 */
const encloses = (outer, inner) =>
  outer.length <= inner.length && outer.every((id, i) => inner[i] === id);

/**
 * A command that is not a `cd`, with the folder it runs in.
 * - `folder` is null when a parser cannot tell.
 * - `before` holds each command that ran earlier in its own shell or a shell
 *   around it. Its own substitutions, and the other stages of its pipeline,
 *   are not in it: they cannot move its shell.
 * @typedef {{ command: Command, folder: string | null, before: Command[] }} Placed
 */

/**
 * Each command in the script that is not a `cd`, with the folder it runs in.
 *
 * The parser lists commands in the order they run, each with the shells it
 * runs in (`scope`). Each shell has its own folder. A shell starts in the
 * folder its parent is in at that point, and a `cd` or `pushd` moves only
 * its own shell, as if it always ran. `popd` lands where a parser cannot
 * tell. A compound body (`{ ... }`, `if ... fi`, a negative scope id) runs in
 * the shell around it unless it is piped or sent to the background, so a
 * `cd` inside one leaves the folder around it unknown.
 * @param {string} script
 * @param {string | null} cwd
 * @returns {Placed[]}
 */
export function placeCommands(script, cwd) {
  /** @type {Map<string, string | null>} */
  const folders = new Map([['', cwd]]);
  /** @type {(scope: number[]) => string | null} */
  const folderIn = (scope) => {
    const key = keyOf(scope);
    if (!folders.has(key)) folders.set(key, folderIn(scope.slice(0, -1)));
    return folders.get(key) ?? null;
  };
  /** @type {(scope: number[], next: string | null) => void} */
  const move = (scope, next) => {
    folders.set(keyOf(scope), next);
    for (let s = scope; (s.at(-1) ?? 0) < 0; s = s.slice(0, -1)) {
      const outer = s.slice(0, -1);
      if (folderIn(outer) !== next) folders.set(keyOf(outer), null);
    }
  };
  /** @type {Placed[]} */
  const placed = [];
  /** @type {Command[]} */
  const earlier = [];
  for (const command of parseCommands(script)) {
    const shell = shellOf(command.scope);
    const before = earlier.filter((each) => encloses(shellOf(each.scope), shell));
    earlier.push(command);
    const folder = folderIn(command.scope);
    const program = command.argv[0];
    if (program === 'cd' || program === 'pushd' || program === 'popd') {
      move(command.scope, program === 'popd' ? null : cdTarget(folder, cdWord(command.argv)));
      continue;
    }
    placed.push({ command, folder, before });
  }
  return placed;
}
