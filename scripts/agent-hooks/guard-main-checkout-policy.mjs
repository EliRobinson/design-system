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
// Pure: it reads the filesystem to classify folders and nothing else, so the
// tests drive every branch from on-disk fixtures.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, posix, resolve, sep } from 'node:path';

import { cdTarget, parseCommands } from './shell-parse.mjs';

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
function subcommandOf(rest) {
  for (let i = 0; i < rest.length; i++) {
    const word = rest[i] ?? '';
    if (!word.startsWith('-')) return word;
    if (SUBCOMMAND_VALUE_FLAGS.has(word)) i++;
  }
  return undefined;
}

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
 * @param {import('./shell-parse.mjs').Command} command
 * @returns {GitCall | null}
 */
export function gitCallOf({ argv, env }) {
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
    const alias = name === '-c' ? /^alias\.([^=]+)=(.*)$/is.exec(value ?? '') : null;
    if (alias?.[1] !== undefined && alias[2] !== undefined) aliases[alias[1]] = alias[2];
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

/**
 * How deep aliases and the shell commands of `!` aliases are followed.
 * Git refuses an alias loop itself, so this only bounds the work.
 */
const MAX_DEPTH = 5;

/**
 * A git call with its aliases swapped for what they run. A plain alias
 * (`cm = commit -m`) becomes its verb and words. A shell alias
 * (`sync = !git pull && git push`) becomes `shell`, the command it runs.
 * @param {GitCall} git
 * @param {AliasLookup} aliasOf
 * @returns {GitCall & { shell?: string }}
 */
function expandAliases(git, aliasOf) {
  let call = git;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (MUTATING_GIT_VERBS.has(call.verb) || READ_ONLY_GIT_VERBS.has(call.verb)) return call;
    const value = call.aliases[call.verb] ?? aliasOf(call.verb);
    if (value === null) return call;
    if (value.startsWith('!')) return { ...call, shell: value.slice(1) };
    const [verb, ...words] = parseCommands(value)[0]?.argv ?? [];
    if (verb === undefined) return call;
    call = { ...call, verb, rest: [...words, ...call.rest] };
  }
  return call;
}

/**
 * Whether a command is `gh pr checkout`, which switches the branch of the
 * folder it runs in.
 * @param {string[]} argv
 */
function isGhPrCheckout(argv) {
  return posix.basename(argv[0] ?? '') === 'gh' && argv[1] === 'pr' && argv[2] === 'checkout';
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
 * checkout counts, so the guard keeps guarding.
 * @param {string | null} dir
 * @param {string | null} mainRoot
 */
function inMainCheckout(dir, mainRoot) {
  if (dir === null) return true;
  const checkout = checkoutOf(dir);
  return (
    checkout !== null &&
    checkout.kind === 'main' &&
    (mainRoot === null || checkout.root === mainRoot)
  );
}

/**
 * The folders a git call may act in. Each `-C` moves git from where it was.
 * Only the first command on the line may use `-C` to leave the folder it
 * runs in: after another command, the folder is this file's best reading,
 * so a later `-C` can add a folder to check but not replace one.
 * @param {GitCall} git
 * @param {string | null} dir The folder the command runs in.
 * @param {boolean} first
 * @returns {Array<string | null>}
 */
function foldersOf(git, dir, first) {
  if (git.pointed) return [null];
  if (git.chdirs.length === 0) return [dir];
  const target = git.chdirs.reduce(cdTarget, dir);
  return first ? [target] : [dir, target];
}

/**
 * @param {string} what The refused command, as {@link refusedIn} names it.
 * @param {string | null} root
 */
function refusalFor(what, root) {
  const where = root ?? 'the main checkout';
  return [
    `Refused: ${what} would change the main checkout (${where}).`,
    '',
    'Other agents share that folder. A write there can commit their files or delete their unstaged edits.',
    '',
    'Work in your own worktree. Make one from the root of the main checkout:',
    '',
    '  git fetch origin',
    '  git worktree add .claude/worktrees/<branch> -b <branch> origin/main',
    '',
    'A `cd` in an earlier call does not carry over. In each command, start the line with',
    '`git -C <absolute worktree path> ...`, or with `cd <absolute worktree path> && git ...`.',
    'A `cd` this hook cannot read (`cd $DIR`, `cd ~`, `cd -`) counts as the main checkout.',
    '',
    `Use the escape only when no worktree can do the job: put ${OVERRIDE}=1 in front of that one command, and say why in your next message.`,
    'See docs/agents/git-workflow.md.',
  ].join('\n');
}

/** @typedef {{ blocked: false } | { blocked: true, reason: string }} GuardDecision */

/**
 * The first command in `command` this guard refuses, named for the
 * refusal, or null.
 *
 * A top-level `cd` or `pushd` moves the folder for the commands after it,
 * as if it always ran. A `cd` in a subshell, a pipeline, a background job,
 * `$(...)` or `bash -c` cannot move the top-level shell, so it moves only a
 * second reading, `nested`, and a nested git call is checked against both.
 * `popd` lands where this file cannot tell.
 *
 * The escape counts only as an env prefix on the git command itself, never
 * from `process.env`: a session that exported it would switch the guard off
 * and nobody would see.
 * @param {string} command
 * @param {string | null} cwd
 * @param {string | null} mainRoot
 * @param {AliasLookup} aliasOf
 * @param {number} depth
 * @returns {string | null}
 */
function refusedIn(command, cwd, mainRoot, aliasOf, depth) {
  if (depth > MAX_DEPTH) return null;
  let dir = cwd;
  let nested = cwd;
  for (const [index, each] of parseCommands(command).entries()) {
    const [program, target] = each.argv;
    if (program === 'cd' || program === 'pushd' || program === 'popd') {
      const next = program === 'popd' ? null : cdTarget(each.top ? dir : nested, target);
      if (each.top) dir = next;
      nested = next;
      continue;
    }
    if (each.env.includes(`${OVERRIDE}=1`)) continue;
    const here = each.top ? [dir] : [dir, nested];
    if (isGhPrCheckout(each.argv)) {
      if (here.some((folder) => inMainCheckout(folder, mainRoot))) return '`gh pr checkout`';
      continue;
    }
    const call = gitCallOf(each);
    if (call === null) continue;
    const git = expandAliases(call, aliasOf);
    const first = index === 0 && each.top;
    const folders = here.flatMap((folder) => foldersOf(git, folder, first));
    if (git.shell !== undefined) {
      // A shell alias runs from the top of the checkout git was in.
      for (const folder of folders) {
        if (refusedIn(git.shell, folder, mainRoot, aliasOf, depth + 1) !== null) {
          return `\`git ${call.verb}\` (a shell alias)`;
        }
      }
      continue;
    }
    if (!MUTATING_GIT_VERBS.get(git.verb)?.(git.rest)) continue;
    if (folders.some((folder) => inMainCheckout(folder, mainRoot))) {
      return git.verb === call.verb
        ? `\`git ${call.verb}\``
        : `\`git ${call.verb}\` (an alias for \`git ${git.verb}\`)`;
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
  const refused = refusedIn(command, cwd, mainRoot, aliasOf, 0);
  return refused === null
    ? { blocked: false }
    : { blocked: true, reason: refusalFor(refused, mainRoot) };
}
