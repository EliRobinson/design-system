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

import { parseCommands } from './shell-parse.mjs';

/** The one escape: `ALLOW_MAIN_CHECKOUT_WRITE=1 git ...`, on that command. */
export const OVERRIDE = 'ALLOW_MAIN_CHECKOUT_WRITE';

/** @type {(rest: string[]) => boolean} */
const ALWAYS = () => true;

/**
 * Mutating unless the first word that is not a flag is one of `safe`.
 * @param {...string} safe
 * @returns {(rest: string[]) => boolean}
 */
const exceptSubcommands =
  (...safe) =>
  (rest) => {
    const first = rest.find((word) => !word.startsWith('-'));
    return first === undefined || !safe.includes(first);
  };

/**
 * Mutating only when the first word that is not a flag is one of `unsafe`.
 * @param {...string} unsafe
 * @returns {(rest: string[]) => boolean}
 */
const onlySubcommands =
  (...unsafe) =>
  (rest) => {
    const first = rest.find((word) => !word.startsWith('-'));
    return first !== undefined && unsafe.includes(first);
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
 * how a guard gets switched off. `fetch`, `push` and `branch` are absent on
 * purpose: they change no working tree, and the coordinator runs them in the
 * main checkout.
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
  ['stash', exceptSubcommands('list', 'show')],
  ['apply', unlessFlag('--check', '--stat', '--numstat', '--summary')],
  // `remove` and `prune` delete other agents' worktrees; `add` is the way out.
  ['worktree', onlySubcommands('remove', 'prune', 'move')],
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
  let i = 1;
  while (i < argv.length && argv[i]?.startsWith('-')) {
    const word = argv[i] ?? '';
    const equals = word.indexOf('=');
    const [name, value] =
      word.startsWith('--') && equals !== -1
        ? [word.slice(0, equals), word.slice(equals + 1)]
        : [word, GIT_VALUE_OPTIONS.has(word) ? argv[i + 1] : undefined];
    if (name === '-C' && value !== undefined) chdirs.push(value);
    if (name === '--git-dir' || name === '--work-tree') pointed = true;
    if (name === '-c' && value?.toLowerCase().startsWith('core.worktree')) pointed = true;
    i += word === name && GIT_VALUE_OPTIONS.has(word) ? 2 : 1;
  }
  const verb = argv[i];
  if (verb === undefined) return null;
  return { verb, rest: argv.slice(i + 1), chdirs, pointed };
}

/**
 * The folder a `cd` (or `pushd`) moves to, or null when this file cannot
 * tell: no argument, `-`, a flag, `~`, or anything built at run time.
 * @param {string | null} dir
 * @param {string | undefined} target
 * @returns {string | null}
 */
function cdInto(dir, target) {
  if (dir === null || target === undefined || /^[-~]|[$`]/.test(target)) return null;
  return resolve(dir, target);
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
  for (let current = resolve(dir); ; current = dirname(current)) {
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
  const target = git.chdirs.reduce(cdInto, dir);
  return first ? [target] : [dir, target];
}

/**
 * @param {string} verb
 * @param {string | null} root
 */
function refusalFor(verb, root) {
  const where = root ?? 'the main checkout';
  return [
    `Refused: \`git ${verb}\` would change the main checkout (${where}).`,
    '',
    'Other agents share that folder. A write there can commit their files or delete their unstaged edits.',
    '',
    'Work in your own worktree:',
    '',
    '  git fetch origin',
    '  git worktree add .claude/worktrees/<branch> -b <branch> origin/main',
    '',
    'Then `cd` into it, or use `git -C <worktree>` as the first command on the line.',
    'A `cd` this hook cannot read (`cd $DIR`, `cd ~`, `cd -`) counts as the main checkout.',
    '',
    `If the command must run in the main checkout, put ${OVERRIDE}=1 in front of that one command, and say why in your next message.`,
    'See docs/agents/git-workflow.md.',
  ].join('\n');
}

/** @typedef {{ blocked: false } | { blocked: true, reason: string }} GuardDecision */

/**
 * Whether to refuse a Bash command. `cd` and `pushd` move the folder for the
 * commands after them, as if they always ran. The escape counts only as an
 * env prefix on the git command itself, never from `process.env`: a session
 * that exported it would switch the guard off and nobody would see.
 * @param {{ command: string, cwd: string }} input
 * @param {string | null} mainRoot The real path of the main checkout to guard.
 * @returns {GuardDecision}
 */
export function guardDecision({ command, cwd }, mainRoot) {
  /** @type {string | null} */
  let dir = cwd;
  for (const [index, each] of parseCommands(command).entries()) {
    const [program, target] = each.argv;
    if (program === 'cd' || program === 'pushd') {
      dir = cdInto(dir, target);
      continue;
    }
    const git = gitCallOf(each);
    if (git === null || each.env.includes(`${OVERRIDE}=1`)) continue;
    if (!MUTATING_GIT_VERBS.get(git.verb)?.(git.rest)) continue;
    if (foldersOf(git, dir, index === 0).some((folder) => inMainCheckout(folder, mainRoot))) {
      return { blocked: true, reason: refusalFor(git.verb, mainRoot) };
    }
  }
  return { blocked: false };
}
