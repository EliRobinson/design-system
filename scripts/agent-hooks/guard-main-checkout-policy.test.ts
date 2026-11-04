// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OVERRIDE, guardDecision, mainCheckoutOf } from './guard-main-checkout-policy.mjs';

// On-disk fixtures, shaped the way git lays them out:
//   main/          a main checkout (`.git` is a directory)
//   main/.claude/worktrees/wt/   a linked worktree (`.git` is a file)
//   other/         another project's main checkout
let root: string;
let main: string;
let wt: string;
let other: string;

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'guard-main-')));
  main = join(root, 'main');
  wt = join(main, '.claude/worktrees/wt');
  other = join(root, 'other');
  mkdirSync(join(main, '.git/worktrees/wt'), { recursive: true });
  mkdirSync(join(main, 'packages/react'), { recursive: true });
  mkdirSync(wt, { recursive: true });
  writeFileSync(join(wt, '.git'), `gitdir: ${join(main, '.git/worktrees/wt')}\n`);
  mkdirSync(join(other, '.git'), { recursive: true });
  symlinkSync(join(main, 'packages'), join(wt, 'shared'));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const decide = (command: string, cwd = main) => guardDecision({ command, cwd }, main);
const refused = (command: string, cwd?: string) => decide(command, cwd).blocked;

describe('mainCheckoutOf', () => {
  it('finds the main checkout from itself, a subfolder, and a linked worktree', () => {
    expect(mainCheckoutOf(main)).toBe(main);
    expect(mainCheckoutOf(join(main, 'packages/react'))).toBe(main);
    expect(mainCheckoutOf(wt)).toBe(main);
  });

  it('is null outside any checkout', () => {
    expect(mainCheckoutOf('/')).toBeNull();
  });
});

describe('guardDecision in the main checkout', () => {
  it.each([
    'git commit -m x',
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
    expect(decision.reason).toContain('git worktree add');
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
    'cd -P /tmp && git add .',
    'pushd $X && git add .',
  ])('counts a cd it cannot evaluate as the main checkout: `%s`', (command) => {
    expect(refused(command, wt)).toBe(true);
  });

  it.each([
    `(cd ${wt}) && git add .`,
    `cd ${wt} | true; git add .`,
    `cd ${wt} & git add .`,
    `pushd ${wt}; popd; git add .`,
    `(cd ${wt} && git add .)`,
  ])('does not let a cd that ends move the line: `%s`', (command) => {
    expect(refused(command)).toBe(true);
  });

  it('checks a nested git against both readings of the folder', () => {
    expect(refused(`(cd ${main} && git add .)`, wt)).toBe(true);
    expect(refused('(cd sub && git add .)', wt)).toBe(false);
  });

  it('does not refuse a read after a cd it cannot evaluate', () => {
    expect(refused('cd $WORKTREE && git status', wt)).toBe(false);
  });
});

describe('git -C', () => {
  it('names another folder only as the first command on the line', () => {
    expect(refused(`git -C ${wt} commit -m x`)).toBe(false);
    expect(refused('git -C .claude/worktrees/wt add .')).toBe(false);
    expect(refused(`true && git -C ${wt} commit -m x`)).toBe(true);
    expect(refused(`echo hi; git -C ${wt} add .`)).toBe(true);
  });

  it('does not count a command inside $(...) as first', () => {
    expect(refused(`echo "$(git -C ${wt} add .)"`)).toBe(true);
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
