// @ts-check
// What the agent hooks do when they fail (#479). It holds:
// - messageOf and hookFailed: the one failure message both hooks print.
// - mayWriteMainCheckout: the guard's crash fallback, which reads the raw
//   command text with no parser.
// It imports no shell parser and no policy, only checkouts.mjs and
// git-write-verbs.mjs, so the hooks can still load it when those throw while
// they load or run.
// See docs/agents/git-and-prs.md and docs/agents/git-workflow.md.

import { homedir } from 'node:os';

import { inMainCheckout, truePath } from './checkouts.mjs';
import { MUTATING_GIT_VERB_NAMES } from './git-write-verbs.mjs';

/**
 * The message of a thrown value, which need not be an Error.
 * @param {unknown} error
 */
export const messageOf = (error) => (error instanceof Error ? error.message : String(error));

/**
 * The refusal for a call a hook failed to read, the same in both hooks.
 * @param {unknown} error
 */
export function hookFailed(error) {
  return [
    `The hook failed (${messageOf(error)}), so this call is blocked.`,
    'File an issue in this repo (label area:ci) with the shape of the command, never secrets or tokens.',
    'A simpler command may run.',
  ].join(' ');
}

/** @param {string} text */
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const WORD_EDGE = String.raw`(?<![\w.-])`;
const WORD_END = String.raw`(?![\w.-])`;
const GIT_WORD = new RegExp(`${WORD_EDGE}git${WORD_END}`);
const GH_WORD = new RegExp(`${WORD_EDGE}gh${WORD_END}`);
const CHECKOUT_WORD = new RegExp(`${WORD_EDGE}checkout${WORD_END}`);
const WRITE_VERB_WORD = new RegExp(
  `${WORD_EDGE}(?:${MUTATING_GIT_VERB_NAMES.map(escaped).join('|')})${WORD_END}`,
);
// A path in raw text runs up to the first character a shell would split on.
const PATH_TAIL = String.raw`[^\s'"\x60;&|()<>]*`;

/**
 * The ways raw text may spell the main checkout: its real path, and, when it
 * is under the home folder, `~/`, `$HOME/` and `${HOME}/` forms of it.
 * @param {string} mainRoot
 * @param {string} home
 */
function spellingsOf(mainRoot, home) {
  const realHome = truePath(home);
  if (!mainRoot.startsWith(`${realHome}/`)) return [mainRoot];
  const below = mainRoot.slice(realHome.length + 1);
  return [mainRoot, `~/${below}`, `$HOME/${below}`, `\${HOME}/${below}`];
}

/**
 * Whether a Bash call may write in the main checkout, read from the raw text
 * alone, with no shell parser. The guard asks this only when its parser or
 * policy failed. It errs towards yes: the call runs in the main checkout, or
 * the text names a folder in it (by its path, or by a `~/`, `$HOME/` or
 * `${HOME}/` path), or holds `git` with any verb in
 * {@link MUTATING_GIT_VERB_NAMES}, or `gh` with `checkout`. It does not
 * catch a relative path, a `..` path, a spelling through a symlink, or a
 * path in another variable.
 * @param {{ text: string, cwd: string }} input
 * @param {string | null} mainRoot Null counts every main checkout.
 * @param {string} [home] The home folder. Tests pass their own.
 */
export function mayWriteMainCheckout({ text, cwd }, mainRoot, home = homedir()) {
  if (inMainCheckout(cwd, mainRoot, [])) return true;
  if (mainRoot !== null) {
    for (const spelling of spellingsOf(mainRoot, home)) {
      for (const [path] of text.matchAll(new RegExp(`${escaped(spelling)}${PATH_TAIL}`, 'g'))) {
        if (inMainCheckout(mainRoot + path.slice(spelling.length), mainRoot, [])) return true;
      }
    }
  }
  if (GIT_WORD.test(text) && WRITE_VERB_WORD.test(text)) return true;
  return GH_WORD.test(text) && CHECKOUT_WORD.test(text);
}
