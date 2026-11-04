// @ts-check
// Rules for the main-checkout guard hook. See docs/agents/git-workflow.md.
//
// The main checkout is shared: the coordinator lives there, and every
// worktree hangs off it. A write into it lands in a tree that other agents
// are reading, and an unstaged edit that `git checkout --` reverts leaves no
// reflog entry to get it back. So this refuses git commands that change the
// working tree, the index, or the branch when they would run there.
//
// It guards against an accident, not an attacker: anything that runs a Bash
// call can also edit this file. When it cannot tell where git will run, it
// says "the main checkout", and the escape below lets one command through.
//
// It has no side effects. It reads the filesystem to classify folders, so
// the tests drive every branch from on-disk fixtures. Git's aliases come in
// through a lookup function, so this file runs no process.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, posix, resolve, sep } from 'node:path';

import { afterFlags, cdTarget, ghCommand, parseCommands, placeCommands } from './shell-parse.mjs';

/** The one escape: `ALLOW_MAIN_CHECKOUT_WRITE=1 git ...`, on that command. */
export const OVERRIDE = 'ALLOW_MAIN_CHECKOUT_WRITE';

/** @type {(rest: string[]) => boolean} */
const ALWAYS = () => true;

// Flags before a sub-subcommand that take a separate value, as in
// `git stash -m list`, whose `list` is the message.
const SUBCOMMAND_VALUE_FLAGS = new Set(['-m', '--message']);

/**
 * The first word of `rest` that is not a flag or a flag's value.
 * @param {string[]} rest
 * @returns {string | undefined}
 */
const subcommandOf = (rest) => afterFlags(rest, SUBCOMMAND_VALUE_FLAGS)[0];

/**
 * Mutating unless the sub-subcommand is one of `safe`.
 * @param {...string} safe
 * @returns {(rest: string[]) => boolean}
 */
const exceptSubcommands =
  (...safe) =>
  (rest) => {
    const sub = subcommandOf(rest);
    return sub === undefined || !safe.includes(sub);
  };

/**
 * Mutating only when the sub-subcommand is one of `unsafe`.
 * @param {...string} unsafe
 * @returns {(rest: string[]) => boolean}
 */
const onlySubcommands =
  (...unsafe) =>
  (rest) => {
    const sub = subcommandOf(rest);
    return sub !== undefined && unsafe.includes(sub);
  };

/**
 * Mutating unless one of `flags` makes it a dry run.
 * @param {...string} flags
 * @returns {(rest: string[]) => boolean}
 */
const unlessFlag =
  (...flags) =>
  (rest) =>
    !rest.some((word) => flags.includes(word));

/**
 * Git verbs that change the working tree, the index, or the checked-out
 * branch, each with the test for whether this call of it does. Everything
 * else is allowed: a blocklist, because a false refusal on a harmless read is
 * how a guard gets switched off. Absent on purpose:
 * - `fetch`, `push` and `branch`: they change no working tree, and the
 *   coordinator runs them in the main checkout.
 * - `update-ref` and `symbolic-ref`: plumbing no agent workflow uses, and
 *   `git symbolic-ref HEAD` is a common read.
 * @type {Map<string, (rest: string[]) => boolean>}
 */
export const MUTATING_GIT_VERBS = new Map([
  ['add', ALWAYS],
  ['am', ALWAYS],
  ['checkout', ALWAYS],
  ['cherry-pick', ALWAYS],
  ['clean', ALWAYS],
  ['commit', ALWAYS],
  ['merge', ALWAYS],
  ['mv', ALWAYS],
  ['pull', ALWAYS],
  ['rebase', ALWAYS],
  ['reset', ALWAYS],
  ['restore', ALWAYS],
  ['revert', ALWAYS],
  ['rm', ALWAYS],
  ['switch', ALWAYS],
  ['read-tree', ALWAYS],
  ['checkout-index', ALWAYS],
  ['update-index', ALWAYS],
  ['stash', exceptSubcommands('list', 'show')],
  ['bisect', exceptSubcommands('log', 'visualize', 'view')],
  ['sparse-checkout', exceptSubcommands('list')],
  ['submodule', onlySubcommands('add', 'update', 'deinit')],
  ['apply', unlessFlag('--check', '--stat', '--numstat', '--summary')],
  // `remove`, `prune` and `move` act on other agents' worktrees. `add` is
  // the way out, so it stays allowed.
  ['worktree', onlySubcommands('remove', 'prune', 'move')],
]);

/**
 * Git's built-in verbs that never change the tree. Git runs a built-in even
 * when an alias of the same name exists, so a verb in this set or in
 * {@link MUTATING_GIT_VERBS} is never looked up as an alias. That keeps the
 * common reads from costing a `git config` call.
 */
const READ_ONLY_GIT_VERBS = new Set([
  'blame',
  'branch',
  'cat-file',
  'config',
  'describe',
  'diff',
  'fetch',
  'for-each-ref',
  'grep',
  'help',
  'log',
  'ls-files',
  'ls-remote',
  'ls-tree',
  'merge-base',
  'push',
  'reflog',
  'remote',
  'rev-list',
  'rev-parse',
  'shortlog',
  'show',
  'show-ref',
  'status',
  'symbolic-ref',
  'tag',
  'version',
]);

// Git's own options that take a separate value.
const GIT_VALUE_OPTIONS = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--config-env',
]);

/**
 * @typedef {object} GitCall
 * @property {string} verb
 * @property {string[]} rest The words after the verb.
 * @property {string[]} chdirs Each `-C` value, in order.
 * @property {boolean} pointed Whether `--git-dir`, `--work-tree`,
 *   `-c core.worktree` or a `GIT_DIR` / `GIT_WORK_TREE` prefix points git at
 *   a tree this file does not follow.
 * @property {Record<string, string>} aliases Each `-c alias.<name>=<value>`.
 */

/**
 * The git call a command makes, or null when it is not git or has no verb.
 * @param {string[]} argv
 * @param {string[]} [env] The `NAME=value` prefixes on the command.
 * @returns {GitCall | null}
 */
export function gitCallOf(argv, env = []) {
  if (posix.basename(argv[0] ?? '') !== 'git') return null;
  /** @type {string[]} */
  const chdirs = [];
  let pointed = env.some((assignment) => /^GIT_(DIR|WORK_TREE)=/.test(assignment));
  /** @type {Record<string, string>} */
  const aliases = {};
  let i = 1;
  while (i < argv.length && argv[i]?.startsWith('-')) {
    const word = argv[i] ?? '';
    const equals = word.indexOf('=');
    /** @type {[string, string | undefined, number]} */
    const [name, value, consumed] =
      word.startsWith('--') && equals !== -1
        ? [word.slice(0, equals), word.slice(equals + 1), 1]
        : GIT_VALUE_OPTIONS.has(word)
          ? [word, argv[i + 1], 2]
          : [word, undefined, 1];
    if (name === '-C' && value !== undefined) chdirs.push(value);
    if (name === '--git-dir' || name === '--work-tree') pointed = true;
    if (name === '-c' && value?.toLowerCase().startsWith('core.worktree')) pointed = true;
    // Git alias names ignore case.
    const alias = name === '-c' ? /^alias\.([^=]+)=(.*)$/is.exec(value ?? '') : null;
    if (alias?.[1] !== undefined && alias[2] !== undefined) {
      aliases[alias[1].toLowerCase()] = alias[2];
    }
    i += consumed;
  }
  const verb = argv[i];
  if (verb === undefined) return null;
  return { verb, rest: argv.slice(i + 1), chdirs, pointed, aliases };
}

/**
 * Looks up `alias.<name>` in git's config. Returns its value, or null.
 * @typedef {(name: string) => string | null} AliasLookup
 */

/** How many aliases deep a call is followed. Git refuses a loop itself. */
const ALIAS_DEPTH = 5;

/** How many shell aliases deep a call is followed. */
const SHELL_ALIAS_DEPTH = 3;

/**
 * What a git call runs once its aliases are swapped in. `name` is the verb
 * as typed.
 * - `builtin`: no alias; `git` is the call.
 * - `alias`: a plain alias (`cm = commit -m`); `git` is what it expands to.
 * - `shell`: a shell alias (`sync = !git pull && git push`); `script` is the
 *   shell command it runs.
 * @typedef {{ kind: 'builtin' | 'alias', name: string, git: GitCall }
 *   | { kind: 'shell', name: string, git: GitCall, script: string }} Resolved
 */

/**
 * @param {GitCall} call
 * @param {AliasLookup} aliasOf
 * @returns {Resolved}
 */
function resolveAliases(call, aliasOf) {
  const name = call.verb;
  let git = call;
  for (let depth = 0; depth < ALIAS_DEPTH; depth++) {
    if (MUTATING_GIT_VERBS.has(git.verb) || READ_ONLY_GIT_VERBS.has(git.verb)) break;
    const key = git.verb.toLowerCase();
    const value = git.aliases[key] ?? aliasOf(key);
    if (value === null) break;
    if (value.startsWith('!')) return { kind: 'shell', name, git, script: value.slice(1) };
    // An alias may start with git's own options: `ci = -c x=y commit`.
    const words = parseCommands(value)[0]?.argv ?? [];
    const inner = gitCallOf(['git', ...words]);
    if (inner === null) break;
    git = {
      verb: inner.verb,
      rest: [...inner.rest, ...git.rest],
      chdirs: [...git.chdirs, ...inner.chdirs],
      pointed: git.pointed || inner.pointed,
      aliases: { ...git.aliases, ...inner.aliases },
    };
  }
  return { kind: git === call ? 'builtin' : 'alias', name, git };
}

/**
 * Whether a command is `gh pr checkout`, which switches the branch of the
 * folder it runs in.
 * @param {string[]} argv
 */
function isGhPrCheckout(argv) {
  const gh = ghCommand(argv);
  return gh?.group === 'pr' && gh.sub === 'checkout';
}

/**
 * The real path of `p`, or `p` when it does not exist.
 * @param {string} p
 */
function truePath(p) {
  try {
    return realpathSync.native(p);
  } catch {
    return p;
  }
}

/**
 * The nearest folder at or above `dir` that holds a `.git`, with what kind
 * it is: a main checkout (`.git` is a folder) or a linked worktree (a file).
 * @param {string} dir
 * @returns {{ root: string, kind: 'main' | 'linked' } | null}
 */
function checkoutOf(dir) {
  // Git works from the real path, so a symlink into another checkout counts
  // as that checkout. Resolve the nearest folder that exists.
  let start = resolve(dir);
  while (!existsSync(start) && dirname(start) !== start) start = dirname(start);
  for (let current = truePath(start); ; current = dirname(current)) {
    const dotGit = join(current, '.git');
    if (existsSync(dotGit)) {
      const kind = statSync(dotGit).isDirectory() ? 'main' : 'linked';
      return { root: truePath(current), kind };
    }
    if (dirname(current) === current) return null;
  }
}

/**
 * The real path of the main checkout that `dir` is in, or is a linked
 * worktree of. Null when that cannot be read from disk.
 * @param {string} dir
 * @returns {string | null}
 */
export function mainCheckoutOf(dir) {
  const checkout = checkoutOf(dir);
  if (checkout === null) return null;
  if (checkout.kind === 'main') return checkout.root;
  let gitdir;
  try {
    gitdir = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(join(checkout.root, '.git'), 'utf8'))?.[1];
  } catch {
    return null;
  }
  if (gitdir === undefined) return null;
  const full = resolve(checkout.root, gitdir);
  const at = full.lastIndexOf(`${sep}.git${sep}worktrees${sep}`);
  return at === -1 ? null : truePath(full.slice(0, at));
}

/**
 * Whether `dir` is in the main checkout `mainRoot`. A null `dir` is a folder
 * this file could not work out, and counts as the main checkout. A null
 * `mainRoot` means the hook could not find its own repo, and then every main
 * checkout counts, so the guard keeps guarding. `added` holds the worktrees
 * that a `git worktree add` earlier on the line makes: they do not exist
 * yet, so the disk cannot say what they are.
 * @param {string | null} dir
 * @param {string | null} mainRoot
 * @param {string[]} added
 */
function inMainCheckout(dir, mainRoot, added) {
  if (dir === null) return true;
  if (added.some((path) => dir === path || dir.startsWith(`${path}${sep}`))) return false;
  const checkout = checkoutOf(dir);
  return (
    checkout !== null &&
    checkout.kind === 'main' &&
    (mainRoot === null || checkout.root === mainRoot)
  );
}

/**
 * The folders a git call may act in. Each `-C` moves git from where it was.
 * A `-C` leaves the folder the command runs in only when the folder is
 * settled (see {@link Placement}): when the command is the first on the line,
 * or when the `-C` is absolute and nothing earlier on the line may have
 * pointed git elsewhere. Otherwise the folder is this file's best reading,
 * so the `-C` adds a folder to check but does not replace one.
 * @param {GitCall} git
 * @param {Placement} placed
 * @returns {Array<string | null>}
 */
function foldersOf(git, { folder, first, gitPointed, envMayPointGit }) {
  if (git.pointed || gitPointed) return [null];
  if (git.chdirs.length === 0) return [folder];
  // An absolute `-C` does not depend on the folder before it.
  const target = git.chdirs.reduce(
    (dir, path) => cdTarget(path.startsWith('/') ? '/' : dir, path),
    folder,
  );
  const absolute = git.chdirs[0]?.startsWith('/') === true;
  return first || (absolute && !envMayPointGit) ? [target] : [folder, target];
}

/** For a walk where no flag takes a value. */
const NO_VALUE_FLAGS = new Set();

/** `git worktree add` flags that take a value. */
const WORKTREE_ADD_VALUE_FLAGS = new Set(['-b', '-B', '--reason']);

/**
 * The path a `git worktree add` makes, or null when the call is not one.
 * @param {GitCall} git
 * @returns {string | null}
 */
function worktreeAddPath(git) {
  if (git.verb !== 'worktree') return null;
  const [sub, ...rest] = afterFlags(git.rest, NO_VALUE_FLAGS);
  return sub === 'add' ? (afterFlags(rest, WORKTREE_ADD_VALUE_FLAGS)[0] ?? null) : null;
}

const GIT_REPO_VARIABLE = /^GIT_(DIR|WORK_TREE)=/;
const DECLARERS = new Set(['export', 'declare', 'typeset', 'readonly', 'local']);

/**
 * Whether a command sets `GIT_DIR` or `GIT_WORK_TREE` for the rest of its
 * shell: `GIT_DIR=x` on its own, or `export GIT_DIR=x`.
 * @param {import('./shell-parse.mjs').Command} command
 */
function pointsGit({ argv, env }) {
  if (argv.length === 0) return env.some((each) => GIT_REPO_VARIABLE.test(each));
  return DECLARERS.has(argv[0] ?? '') && argv.slice(1).some((w) => GIT_REPO_VARIABLE.test(w));
}

/**
 * Whether a command may set them, in a way this file cannot read: `source`
 * or `.` runs another file, `set -a` exports every later assignment, and a
 * declaration can build the variable's NAME at run time (`export $X=y`).
 * @param {import('./shell-parse.mjs').Command} command
 */
function mayPointGit({ argv }) {
  const [program = '', ...args] = argv;
  if (program === 'source' || program === '.') return true;
  if (program === 'set') {
    return args.some(
      (arg, i) => /^-[a-zA-Z]*a/.test(arg) || (arg === '-o' && args[i + 1] === 'allexport'),
    );
  }
  return DECLARERS.has(program) && args.some((arg) => /[$`]/.test(arg.split('=')[0] ?? ''));
}

/**
 * @typedef {object} Placement
 * @property {string | null} folder The folder the command's shell is in.
 *   Null when this file cannot tell.
 * @property {boolean} first Whether no command ran before it in its own
 *   shell or a shell around it.
 * @property {boolean} gitPointed Whether an earlier command in its own shell
 *   or a shell around it set `GIT_DIR` or `GIT_WORK_TREE`.
 * @property {boolean} envMayPointGit Whether one may have.
 */

/**
 * @param {import('./shell-parse.mjs').Placed} placed
 * @returns {Placement}
 */
function placementOf({ folder, before }) {
  return {
    folder,
    // A bare `NAME=value` cannot move the folder.
    first: before.every((each) => each.argv.length === 0),
    gitPointed: before.some(pointsGit),
    envMayPointGit: before.some((each) => pointsGit(each) || mayPointGit(each)),
  };
}

/**
 * @param {string} what The refused command, as {@link refusedIn} names it.
 * @param {string | null} root
 */
function refusalFor(what, root) {
  const main = root ?? '<main checkout>';
  return [
    `Refused: ${what} would change the main checkout (${main}).`,
    '',
    'Other agents share that folder. A write there can commit their files or delete their unstaged edits.',
    '',
    'Work in your own worktree:',
    '',
    `  git -C ${main} fetch origin`,
    `  git -C ${main} worktree add ${main}/.claude/worktrees/<branch> -b <branch> origin/main`,
    '',
    'A `cd` in an earlier call does not carry over. In each command, start the line with',
    '`git -C <absolute worktree path> ...`, or with `cd <absolute worktree path> && git ...`.',
    'A `cd` this hook cannot read (`cd $DIR`, `cd ~`, `cd -`) counts as the main checkout.',
    '',
    `Use the escape only when no worktree can do the job: put ${OVERRIDE}=1 in front of that one git command, and say why in your next message.`,
    'See docs/agents/git-workflow.md.',
  ].join('\n');
}

/** @typedef {{ blocked: false } | { blocked: true, reason: string }} GuardDecision */

/**
 * The first command on `line` this guard refuses, named for the refusal, or
 * null. The escape counts only as an env prefix on the command itself, never
 * from `process.env`: a session that exported it would switch the guard off
 * and nobody would see.
 * @param {string} line
 * @param {string | null} cwd
 * @param {string | null} mainRoot
 * @param {AliasLookup} aliasOf
 * @param {number} depth How many shell aliases deep this line is.
 * @param {string[]} added Worktrees `git worktree add` has made on the line
 *   so far. Shared with the shell aliases the line runs, and added to.
 * @returns {string | null}
 */
function refusedIn(line, cwd, mainRoot, aliasOf, depth, added) {
  const inMain = (/** @type {string | null} */ folder) => inMainCheckout(folder, mainRoot, added);
  for (const item of placeCommands(line, cwd)) {
    const { command, folder } = item;
    const placed = placementOf(item);
    if (command.env.includes(`${OVERRIDE}=1`)) continue;
    if (isGhPrCheckout(command.argv)) {
      if (inMain(folder)) return '`gh pr checkout`';
      continue;
    }
    const call = gitCallOf(command.argv, command.env);
    if (call === null) continue;
    const resolved = resolveAliases(call, aliasOf);
    const folders = foldersOf(resolved.git, placed);
    if (resolved.kind === 'shell') {
      // A shell alias runs from the top of the checkout git was in.
      const refused =
        depth < SHELL_ALIAS_DEPTH &&
        folders.some((at) => {
          const top = at === null ? null : (checkoutOf(at)?.root ?? at);
          return refusedIn(resolved.script, top, mainRoot, aliasOf, depth + 1, added) !== null;
        });
      if (refused) return `\`git ${resolved.name}\` (a shell alias)`;
      continue;
    }
    const { git } = resolved;
    const path = worktreeAddPath(git);
    if (path !== null) {
      for (const at of folders) {
        // A path that exists already is not a new worktree.
        const made = cdTarget(at, path);
        if (made !== null && !existsSync(made)) added.push(made);
      }
      continue;
    }
    if (!MUTATING_GIT_VERBS.get(git.verb)?.(git.rest)) continue;
    if (folders.some(inMain)) {
      return resolved.kind === 'alias'
        ? `\`git ${resolved.name}\` (an alias for \`git ${git.verb}\`)`
        : `\`git ${resolved.name}\``;
    }
  }
  return null;
}

/**
 * Whether to refuse a Bash command. See {@link refusedIn}.
 * @param {{ command: string, cwd: string }} input
 * @param {string | null} mainRoot The real path of the main checkout to guard.
 * @param {AliasLookup} [aliasOf] Reads git's aliases. The default knows none.
 * @returns {GuardDecision}
 */
export function guardDecision({ command, cwd }, mainRoot, aliasOf = () => null) {
  const refused = refusedIn(command, cwd, mainRoot, aliasOf, 0, []);
  return refused === null
    ? { blocked: false }
    : { blocked: true, reason: refusalFor(refused, mainRoot) };
}
