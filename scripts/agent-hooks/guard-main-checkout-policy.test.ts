// @vitest-environment node
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Checkouts, makeCheckouts, removeCheckouts } from './checkout-fixtures';
import { MUTATING_GIT_VERB_NAMES } from './git-write-verbs.mjs';
import { OVERRIDE, VERB_TESTS, guardDecision } from './guard-main-checkout-policy.mjs';
import {
  NESTED_GLOB_NAMES,
  TIME_BUDGET_MS,
  msToRun,
  nestedEGroups,
  nestedGlob,
  nestedCdProcessSubstitutions,
  nestedCdSubshells,
  nestedProcessSubstitutions,
  nestedSubstitutionGlobs,
  processSubstitutionRow,
} from './shell-parse-fixtures';
import { NESTED_READ_LIMIT } from './shell-parse.mjs';

// On-disk fixtures: see checkout-fixtures.ts.
let fixture: Checkouts;
let root: string;
let main: string;
let wt: string;
let other: string;

beforeAll(() => {
  fixture = makeCheckouts('guard-main-');
  ({ root, main, wt, other } = fixture);
});

afterAll(() => removeCheckouts(fixture));

const decide = (command: string, cwd = main) => guardDecision({ command, cwd }, main);
const refused = (command: string, cwd?: string) => decide(command, cwd).blocked;

describe('MUTATING_GIT_VERB_NAMES', () => {
  it('holds the verbs the guard can refuse', () => {
    expect(MUTATING_GIT_VERB_NAMES).toEqual([
      'add',
      'am',
      'checkout',
      'cherry-pick',
      'clean',
      'commit',
      'merge',
      'mv',
      'pull',
      'rebase',
      'reset',
      'restore',
      'revert',
      'rm',
      'switch',
      'read-tree',
      'checkout-index',
      'update-index',
      'stash',
      'bisect',
      'sparse-checkout',
      'submodule',
      'apply',
      'worktree',
    ]);
  });

  it.each(Object.keys(VERB_TESTS))('has a test only for a listed verb: %s', (verb) => {
    expect(MUTATING_GIT_VERB_NAMES).toContain(verb);
  });
});

describe('guardDecision in the main checkout', () => {
  it.each([
    'git commit -m x',
    'git am x.patch',
    'git checkout -- file.ts',
    'git checkout main',
    'git switch -c x',
    'git reset --hard',
    'git stash',
    'git stash -u',
    'git stash pop',
    'git merge origin/main',
    'git rebase origin/main',
    'git add -A',
    'git restore file.ts',
    'git clean -fd',
    'git worktree remove .claude/worktrees/x',
    'git worktree prune',
    'git pull',
    'git rm file.ts',
    'git mv a b',
    'git cherry-pick abc',
    'git revert abc',
    'git apply fix.patch',
    'git read-tree HEAD',
    'git checkout-index -a -f',
    'git update-index --add x',
    'git bisect start HEAD HEAD~5',
    'git sparse-checkout set x',
    'git submodule update --init',
    'git stash -m list',
    'gh pr checkout 12',
    'gh pr -R o/r checkout 12',
    'gh -R o/r pr checkout 12',
    'gh --repo=o/r pr checkout 12',
  ])('refuses `%s`', (command) => {
    expect(refused(command)).toBe(true);
  });

  it.each([
    'git status',
    'git log --oneline',
    'git diff',
    'git show HEAD',
    'git fetch origin',
    'git fetch --prune',
    'git rev-parse HEAD',
    'git ls-remote origin',
    'git ls-tree HEAD',
    'git push -u origin x',
    'git worktree add .claude/worktrees/x -b x origin/main',
    'git worktree list',
    'git stash list',
    'git stash show -p',
    'git apply --check fix.patch',
    'git branch -D old',
    'git bisect log',
    'git sparse-checkout list',
    'git submodule status',
    'gh pr view 12',
  ])('allows `%s`', (command) => {
    expect(refused(command)).toBe(false);
  });

  it('refuses from a subfolder of the main checkout', () => {
    expect(refused('git add .', join(main, 'packages/react'))).toBe(true);
  });

  it('reads past git options to find the verb', () => {
    expect(refused('git -c user.name=x commit -m y')).toBe(true);
    expect(refused('git --no-pager -c core.pager=cat add .')).toBe(true);
    expect(refused('/usr/bin/git add .')).toBe(true);
  });

  it('names the verb, the folder, and the escape in the refusal', () => {
    const decision = decide('git add -A');
    expect(decision.blocked).toBe(true);
    if (!decision.blocked) return;
    expect(decision.reason).toContain('git add');
    expect(decision.reason).toContain(main);
    expect(decision.reason).toContain(`${OVERRIDE}=1`);
    expect(decision.reason).toContain(`git -C ${main} worktree add ${main}/.claude/worktrees/`);
  });
});

describe('guardDecision outside the main checkout', () => {
  it('allows tree-changing git in a linked worktree', () => {
    expect(refused('git add -A && git commit -m x', wt)).toBe(false);
    expect(refused('git reset --hard', wt)).toBe(false);
  });

  it("allows tree-changing git in another project's checkout", () => {
    expect(refused('git commit -m x', other)).toBe(false);
  });

  it('follows a symlink into the main checkout', () => {
    expect(refused('git add .', join(wt, 'shared'))).toBe(true);
    expect(refused('cd shared && git add .', wt)).toBe(true);
  });

  it('allows a folder that is in no checkout', () => {
    expect(refused('git init && git add .', root)).toBe(false);
  });
});

describe('cd', () => {
  it('follows a cd it can evaluate', () => {
    expect(refused(`cd ${wt} && git commit -m x`)).toBe(false);
    expect(refused('cd .claude/worktrees/wt && git add .')).toBe(false);
    expect(refused(`cd ${main} && git commit -m x`, wt)).toBe(true);
    expect(refused('cd ../../.. && git add .', wt)).toBe(true);
  });

  it.each([
    'cd $WORKTREE && git commit -m x',
    'cd "$(git rev-parse --show-toplevel)" && git add .',
    'cd ~/Code/design-system && git add .',
    'cd && git add .',
    'cd - && git add .',
    'cd -x /tmp && git add .',
    'pushd $X && git add .',
  ])('counts a cd it cannot evaluate as the main checkout: `%s`', (command) => {
    expect(refused(command, wt)).toBe(true);
  });

  it.each([
    `(cd ${wt}) && git add .`,
    `cd ${wt} | true; git add .`,
    `cd ${wt} & git add .`,
    `pushd ${wt}; popd; git add .`,
  ])('does not let a cd that ends move the line: `%s`', (command) => {
    expect(refused(command)).toBe(true);
  });

  it('follows a cd inside a subshell for that subshell only', () => {
    expect(refused(`(cd ${wt} && git add .)`)).toBe(false);
    expect(refused(`(cd ${main} && git add .)`, wt)).toBe(true);
    expect(refused(`(cd ${main}); git log | cat; (git add .)`, wt)).toBe(false);
    expect(refused(`bash -c "cd ${wt} && git add ."`)).toBe(false);
  });

  it('checks a nested git in the folder it runs in, not a later one', () => {
    expect(refused(`bash -c "git commit -m x"; cd ${wt}`)).toBe(true);
    expect(refused(`echo $(git commit -m x); cd ${wt}`)).toBe(true);
    expect(refused(`eval 'git commit -m x'; cd ${wt}`)).toBe(true);
    expect(refused(`out=$(git pull 2>&1); cd ${wt} && git status`)).toBe(true);
  });

  it('sends a whole and-or list to the background with &', () => {
    expect(refused(`cd ${wt} && sleep 1 & git add .`)).toBe(true);
    expect(refused(`cd ${main} && sleep 1 & git add .`, wt)).toBe(false);
    expect(refused(`cd ${main} && (true &) ; git commit -m x`, wt)).toBe(true);
  });

  it('counts a piped or backgrounded compound body as its own shell', () => {
    expect(refused(`{ cd ${wt}; } | cat; git add .`)).toBe(true);
    expect(refused(`{ cd ${wt}; } & git add .`)).toBe(true);
    expect(refused(`if true; then cd ${wt}; fi | cat; git add .`)).toBe(true);
    expect(refused(`echo | { cd ${wt}; git add .; }`)).toBe(false);
  });

  it('leaves the folder unknown after a cd in a compound body', () => {
    expect(refused(`{ cd ${main}; }; git add .`, wt)).toBe(true);
    expect(refused(`if true; then cd ${main}; fi; git add .`, wt)).toBe(true);
    expect(refused(`f() { cd ${wt}; }; git add .`)).toBe(true);
    expect(refused(`{ cd ${wt}; git add .; }`)).toBe(false);
  });

  it('runs eval in the current shell', () => {
    expect(refused(`eval "cd ${main}"; git add .`, wt)).toBe(true);
    expect(refused(`eval "cd ${wt}"; git add .`)).toBe(false);
  });

  it('skips the link flags of cd', () => {
    expect(refused(`cd -P ${wt} && git commit -m x`)).toBe(false);
    expect(refused(`cd -L -- ${wt} && git commit -m x`)).toBe(false);
  });

  it('reads the same cd forms as the review gate', () => {
    // A cd the hook cannot read counts as the main checkout.
    expect(refused('cd && git add .', wt)).toBe(true);
    expect(refused('cd - && git add .', wt)).toBe(true);
    expect(refused('cd ~/x && git add .', wt)).toBe(true);
    // A quoted path is one word, and a relative path is read from the cwd.
    expect(refused(`cd "${wt}" && git add .`, main)).toBe(false);
    expect(refused('cd .. && git add .', wt)).toBe(true);
    expect(refused(`cd ${wt}/. && git add .`, main)).toBe(false);
    expect(refused(`pushd ${wt} && git add .`, main)).toBe(false);
    // `git -C` and `cd` agree on where git runs.
    expect(refused(`git -C ${wt} add .`, main)).toBe(false);
    expect(refused(`git -C ${main} add .`, wt)).toBe(true);
  });

  it('keeps a trailing slash on a new worktree from hiding it', () => {
    const made = `${main}/.claude/wt-nonexistent-x`;
    expect(refused(`git worktree add ${made}/ -b b && cd ${made} && git commit -m x`)).toBe(false);
    expect(refused(`git worktree add ${made} -b b && cd ${made}/ && git commit -m x`)).toBe(false);
  });

  it('reads &> as a redirect, not a background job', () => {
    expect(refused(`cd ${wt} &>/dev/null && git commit -m x`)).toBe(false);
    expect(refused(`git -C ${wt} commit -m x &>/dev/null`)).toBe(false);
  });

  it('counts a worktree that git worktree add makes earlier on the line', () => {
    const made = join(main, '.claude/worktrees/new');
    expect(
      refused(
        'git worktree add .claude/worktrees/new -b new origin/main && cd .claude/worktrees/new && git add .',
      ),
    ).toBe(false);
    expect(
      refused(`git -C ${main} worktree add ${made} -b new origin/main && git -C ${made} add .`),
    ).toBe(false);
    expect(refused(`git worktree add ${made} && cd ${made} && git add .`, wt)).toBe(false);
    expect(refused(`git worktree add ${made} && git add .`)).toBe(true);
  });

  it('does not count a path that exists as a new worktree', () => {
    expect(refused('git worktree add . ; git add .')).toBe(true);
    expect(refused('git worktree add packages; cd packages && git add .')).toBe(true);
  });

  it('does not refuse a read after a cd it cannot evaluate', () => {
    expect(refused('cd $WORKTREE && git status', wt)).toBe(false);
  });
});

describe('git -C', () => {
  it('lets a relative -C name another folder only as the first command', () => {
    const rel = '.claude/worktrees/wt';
    expect(refused(`git -C ${rel} add .`)).toBe(false);
    expect(refused(`true && git -C ${rel} commit -m x`)).toBe(true);
    expect(refused(`echo hi; git -C ${rel} add .`)).toBe(true);
    expect(refused(`echo hi; echo "$(git -C ${rel} add .)"`)).toBe(true);
    expect(refused(`FOO=bar; git -C ${rel} commit -m x`)).toBe(false);
  });

  it('lets an absolute -C name another folder anywhere on the line', () => {
    expect(refused(`git -C ${wt} commit -m x`)).toBe(false);
    expect(refused(`true && git -C ${wt} commit -m x`)).toBe(false);
    expect(refused(`git -C ${wt} add . && git -C ${wt} commit -m x`)).toBe(false);
  });

  it('does not trust a later -C after a command that may point git elsewhere', () => {
    expect(refused(`source env.sh && git -C ${wt} add .`)).toBe(true);
    expect(refused(`set -a; git -C ${wt} add .`)).toBe(true);
    expect(refused(`export $NAME=x; git -C ${wt} add .`)).toBe(true);
  });

  it('trusts a later absolute -C after setup lines that cannot point git', () => {
    expect(refused(`set -euo pipefail; git -C ${wt} commit -m x`)).toBe(false);
    expect(refused(`export PATH=$PATH:/x && git -C ${wt} commit -m x`)).toBe(false);
    expect(refused(`export FOO=1; git add .`, wt)).toBe(false);
  });

  it('counts GIT_DIR set earlier on the line as the main checkout', () => {
    expect(refused(`GIT_DIR=${main}/.git; git -C ${wt} add .`)).toBe(true);
    expect(refused(`GIT_DIR=x\ngit add .`, wt)).toBe(true);
    expect(refused('export GIT_DIR=x; git add .', wt)).toBe(true);
    expect(refused(`{ export GIT_DIR=${main}/.git; }; git -C ${wt} commit -m x`)).toBe(true);
  });

  it('trusts an absolute -C after a folder it cannot read', () => {
    expect(refused(`cd "$HOME" && git -C ${wt} commit -m x`)).toBe(false);
    expect(refused(`{ cd ${wt}; }; git -C ${wt} commit -m x`)).toBe(false);
    expect(refused(`popd; git -C ${wt} commit -m x`)).toBe(false);
  });

  it('does not count its own substitutions or pipe stages as earlier', () => {
    const heredoc = `git -C ${wt} commit -m "$(cat <<'EOF'\nfeat: x\n\nbody\nEOF\n)"`;
    expect(refused(heredoc)).toBe(false);
    expect(refused(`git -C .claude/worktrees/wt commit -m "$(date)"`)).toBe(false);
    expect(refused(`git -C .claude/worktrees/wt add $(git diff --name-only)`)).toBe(false);
    expect(refused('echo hi | git -C .claude/worktrees/wt commit -F -')).toBe(false);
    expect(refused(`echo "$(git -C .claude/worktrees/wt add .)"`)).toBe(false);
    expect(refused(`git -C ${wt} commit -m x 2>&1 | tail -5`)).toBe(false);
  });

  it('can always point INTO the main checkout', () => {
    expect(refused(`git -C ${main} commit -m x`, wt)).toBe(true);
    expect(refused(`cd ${wt} && git -C ${main} add .`, wt)).toBe(true);
    expect(refused(`git -C ${wt} -C ../../.. add .`)).toBe(true);
  });

  it('does not refuse a later -C that stays in a worktree', () => {
    expect(refused('pnpm test && git -C packages add .', wt)).toBe(false);
  });

  it('counts a -C built at run time as the main checkout', () => {
    expect(refused('git -C $WT commit -m x', wt)).toBe(true);
    expect(refused('git -C "$(pwd)" add .', wt)).toBe(true);
  });

  it('counts --git-dir, --work-tree, core.worktree and GIT_DIR as the main checkout', () => {
    expect(refused(`git --git-dir=${main}/.git add .`, wt)).toBe(true);
    expect(refused(`git --work-tree ${main} add .`, wt)).toBe(true);
    expect(refused(`git -c core.worktree=${main} add .`, wt)).toBe(true);
    expect(refused(`GIT_DIR=${main}/.git git add .`, wt)).toBe(true);
    expect(refused(`GIT_WORK_TREE=${main} git add .`, wt)).toBe(true);
  });
});

describe('aliases', () => {
  const aliases: Record<string, string> = {
    cm: 'commit -m',
    aa: 'add -A',
    lg: 'log --graph',
    sync: '!git pull --rebase && git push',
    hist: '!git log --oneline',
    outer: 'inner',
    inner: 'checkout',
  };
  const aliasOf = (name: string) => aliases[name] ?? null;
  const decideWith = (command: string, cwd = main) =>
    guardDecision({ command, cwd }, main, aliasOf);

  it.each(['git cm "wip"', 'git aa', 'git sync', 'git outer main'])(
    'refuses a mutating alias: `%s`',
    (command) => {
      expect(decideWith(command).blocked).toBe(true);
    },
  );

  it.each(['git lg', 'git hist'])('allows a read-only alias: `%s`', (command) => {
    expect(decideWith(command).blocked).toBe(false);
  });

  it('allows a mutating alias in a worktree', () => {
    expect(decideWith('git cm "wip"', wt).blocked).toBe(false);
    expect(decideWith('git sync', wt).blocked).toBe(false);
  });

  it('reads an alias given with -c', () => {
    expect(refused('git -c alias.ci=commit ci -m x')).toBe(true);
    expect(refused('git -c alias.ci=status ci')).toBe(false);
  });

  it('reads git options at the front of an alias', () => {
    expect(refused("git -c alias.x='-c user.name=a commit' x -m y")).toBe(true);
    expect(refused(`git -c alias.x='-C ${wt} commit' x -m y`)).toBe(false);
  });

  it('ignores case in alias names, as git does', () => {
    expect(refused('git -c alias.CM=commit cm -m x')).toBe(true);
    expect(decideWith('git CM x').blocked).toBe(true);
  });

  it('names the alias and what it runs in the refusal', () => {
    const decision = decideWith('git cm "wip"');
    expect(decision.blocked && decision.reason).toContain('`git cm` (an alias for `git commit`)');
  });

  it('does not look up a built-in verb, since git runs the built-in', () => {
    const lookup = vi.fn(aliasOf);
    guardDecision({ command: 'git status && git add .', cwd: wt }, main, lookup);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('the escape', () => {
  it('lets one command through as a prefix', () => {
    expect(refused(`${OVERRIDE}=1 git commit -m x`)).toBe(false);
  });

  it('covers only the command it prefixes', () => {
    expect(refused(`${OVERRIDE}=1 git add . && git commit -m x`)).toBe(true);
    expect(refused(`${OVERRIDE}=1 true && git commit -m x`)).toBe(true);
  });

  it.each([
    `export ${OVERRIDE}=1; git commit -m x`,
    `${OVERRIDE}=1; git commit -m x`,
    `git commit -m "${OVERRIDE}=1"`,
    `${OVERRIDE}=0 git commit -m x`,
    `${OVERRIDE}=true git commit -m x`,
  ])('is not `%s`', (command) => {
    expect(refused(command)).toBe(true);
  });

  it('is never read from the environment', () => {
    const saved = process.env[OVERRIDE];
    process.env[OVERRIDE] = '1';
    try {
      expect(refused('git commit -m x')).toBe(true);
    } finally {
      if (saved === undefined) delete process.env[OVERRIDE];
      else process.env[OVERRIDE] = saved;
    }
  });
});

describe('what the parser sees', () => {
  // A worktree that does not exist yet, which a line makes.
  const newWorktree = () => join(main, '.claude/worktrees/zz-new-wt');
  const fromBoth = [
    ['the main checkout', () => main],
    ['a worktree', () => wt],
  ] as const;

  it('does not read a heredoc body as commands', () => {
    expect(refused("cat > notes.md <<'EOF'\ngit add -A\nEOF")).toBe(false);
  });

  it('reads commands in substitutions, bash -c, eval, and wrappers', () => {
    expect(refused('echo "$(git stash)"')).toBe(true);
    expect(refused('bash -c "git add -A"')).toBe(true);
    expect(refused('eval "git reset --hard"')).toBe(true);
    expect(refused('sudo git checkout main')).toBe(true);
    expect(refused('if true; then git add .; fi')).toBe(true);
  });

  it.each([
    'time(git add -A)',
    'coproc(git stash)',
    'select(git add -A)',
    'echo $(f( ) { git add .; }; f)',
    'time -p(git add -A)',
    '! time -p(git add -A)',
    'echo $(time -p(git add -A))',
    'case x in(x) git add -A;; esac',
    'coproc foo(git add -A)',
  ])('reads commands in a ( glued to a word: %s', (command) => {
    expect(refused(command)).toBe(true);
  });

  // Process substitutions and zsh's `=git` (#469).
  it.each([
    'cat <(git add -A)',
    'tee >(git stash) >/dev/null',
    'cat < <(git add -A)',
    'cat <(x <(git add -A))',
    'echo >>(git add -A)',
    nestedProcessSubstitutions(NESTED_READ_LIMIT + 8, 'git add -A'),
    '=git add -A',
    'sudo =git add -A',
  ])('reads commands in a process substitution or as =git: %s', (command) => {
    expect(refused(command)).toBe(true);
  });

  it.each(['diff <(sort a) <(sort b)', 'cat <(git status)'])(
    'lets a process substitution that changes nothing through: %s',
    (command) => {
      expect(refused(command)).toBe(false);
    },
  );

  // A process substitution runs in a subshell of its own, and `=cd` runs
  // `/usr/bin/cd` in a process of its own: neither moves what comes after.
  it.each([
    'cat <(cd .claude/worktrees/wt); git add -A',
    'cat > >(cd .claude/worktrees/wt); git add -A',
    '=cd .claude/worktrees/wt; git add -A',
  ])('keeps a cd there from moving later commands: %s', (command) => {
    expect(refused(command)).toBe(true);
  });

  it.each([
    ['nested 4000 deep', nestedProcessSubstitutions(4000)],
    ['4000 in a row', processSubstitutionRow(4000)],
    ['nested 2000 deep, each with a cd', nestedCdProcessSubstitutions(2000)],
    ['in subshells nested 2000 deep, each with a cd', nestedCdSubshells(2000)],
  ])('decides on process substitutions %s in a time budget', (_, command) => {
    expect(msToRun(() => decide(command))).toBeLessThan(TIME_BUDGET_MS);
  });

  // zsh runs a glob qualifier's e string as shell code (#465).
  it.each([
    "ls *(e:'git add -A':)",
    'ls *(e:"git stash":)',
    "ls *(e['git reset --hard'])",
    "ls (a|b)(e:'git add -A':)",
  ])('reads the e string of a glob qualifier: %s', (command) => {
    expect(refused(command)).toBe(true);
  });

  it.each(["ls *(e:'cd ../../..':); git add -A", "for f (*(e:'cd ../../..':)) git commit -m x"])(
    'counts a cd in an e string as a folder it cannot follow: %s',
    (command) => {
      expect(refused(command, wt)).toBe(true);
    },
  );

  it.each(NESTED_GLOB_NAMES)('refuses a commit before a deeply nested glob group: %s', (form) => {
    expect(refused(`git commit -m x; ${nestedGlob(form)}`)).toBe(true);
  });

  // Main took seconds on this shape: placing each command was quadratic.
  it.each([
    ['with a $(...)', nestedSubstitutionGlobs(1000)],
    ['running git', nestedEGroups(400)],
  ])('decides on nested glob groups %s in a time budget', (_, command) => {
    expect(msToRun(() => decide(command))).toBeLessThan(TIME_BUDGET_MS);
  });

  it.each([
    'coproc foo { git add -A; }',
    'coproc foo ( git add -A )',
    'coproc { git add -A; }',
    'coproc foo while true; do git add -A; done',
    'coproc git add -A',
  ])('reads the command a coproc runs: %s', (command) => {
    expect(refused(command)).toBe(true);
  });

  it('follows a cd into the main checkout inside a coproc body', () => {
    expect(refused('coproc foo { cd ../../..; git add -A; }', wt)).toBe(true);
  });

  // A coproc's body runs in a subshell, so a cd in it does not move what
  // comes after, and its closer does not close the group around it.
  it.each([
    '(coproc foo { :; }; cd .claude/worktrees/wt); git add -A',
    '(coproc { :; }; cd .claude/worktrees/wt); git add -A',
    'coproc { true; cd .claude/worktrees/wt; }; git add -A',
    'coproc foo { true; cd .claude/worktrees/wt; }; git add -A',
    'coproc cd .claude/worktrees/wt; git add -A',
    'if x; then coproc foo { y; }; cd .claude/worktrees/wt; fi; git add -A',
    'coproc foo while x; do cd .claude/worktrees/wt; done; git add -A',
    'time coproc foo { true; cd .claude/worktrees/wt; }; git add -A',
    '{ coproc foo { true; }; cd .claude/worktrees/wt; }; git add -A',
  ])(
    'keeps a cd inside a coproc or a group around it from moving later commands: %s',
    (command) => {
      expect(refused(command)).toBe(true);
    },
  );

  // A coprocess runs while the line goes on: its worktree (NEW) may not exist yet.
  it.each([
    'coproc git worktree add NEW; cd NEW && git commit -m x',
    'coproc foo { git worktree add NEW; }; cd NEW && git commit -m x',
    'coproc { git worktree add NEW; }; cd NEW && git commit -m x',
    'coproc foo ( git worktree add NEW ); cd NEW && git commit -m x',
    'coproc git worktree add NEW; git -C NEW commit -m x',
    'coproc echo $(git worktree add NEW); git -C NEW commit -m x',
    'coproc foo { bash -c "git worktree add NEW"; }; git -C NEW commit -m x',
  ])('does not count a worktree a coproc makes as made: %s', (form) => {
    expect(refused(form.replaceAll('NEW', newWorktree()))).toBe(true);
  });

  // A process substitution runs while the line goes on, like a coproc (#469).
  it.each([
    'cat <(git worktree add NEW); cd NEW && git commit -m x',
    'tee >(git worktree add NEW); git -C NEW commit -m x',
  ])('does not count a worktree a process substitution makes as made: %s', (form) => {
    expect(refused(form.replaceAll('NEW', newWorktree()))).toBe(true);
  });

  // #473: a background job runs while the line goes on, like a coproc.
  it.each(
    [
      'git worktree add NEW & cd NEW && git commit -m x',
      'git worktree add NEW & cd NEW; git commit -m x',
      'git worktree add NEW & git -C NEW commit -m x',
      'git worktree add NEW & wait; cd NEW && git commit -m x',
      '(git worktree add NEW; true) & git -C NEW commit -m x',
      '{ git worktree add NEW; true; } & git -C NEW commit -m x',
    ].flatMap((form) => fromBoth.map(([where, cwd]) => [form, where, cwd] as const)),
  )('does not count a worktree a background job makes as made: %s, from %s', (form, _, cwd) => {
    expect(refused(form.replaceAll('NEW', newWorktree()), cwd())).toBe(true);
  });

  it.each(fromBoth)(
    'still counts a worktree that git worktree add makes before &&, from %s (#473)',
    (_, cwd) => {
      const made = newWorktree();
      expect(refused(`git worktree add ${made} && cd ${made} && git commit -m x`, cwd())).toBe(
        false,
      );
    },
  );

  // A `;` inside the group does not keep the cd before it out of the job.
  it.each(['(cd MAIN; git commit -m x) & wait', '{ cd MAIN; git commit -m x; } & wait'])(
    'follows a cd into the main checkout inside a group sent to the background: %s',
    (form) => {
      expect(refused(form.replaceAll('MAIN', main), wt)).toBe(true);
    },
  );

  it('counts a worktree made before a coproc on the line', () => {
    const made = newWorktree();
    expect(refused(`git worktree add ${made}; coproc foo { git -C ${made} commit -m x; }`)).toBe(
      false,
    );
  });

  it('allows a line with no git at all', () => {
    expect(refused('pnpm test')).toBe(false);
    expect(refused('')).toBe(false);
  });
});

describe('when the main checkout cannot be found', () => {
  it('guards every main checkout rather than none', () => {
    expect(guardDecision({ command: 'git add .', cwd: other }, null).blocked).toBe(true);
    expect(guardDecision({ command: 'git add .', cwd: wt }, null).blocked).toBe(false);
  });
});
