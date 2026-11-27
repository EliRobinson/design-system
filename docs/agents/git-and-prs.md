# Git, hooks, and pull requests

## Review gate (before a PR is opened)

Before a PR is opened, read-only reviewers run on the branch diff. The `review-gate` skill (`.agents/skills/review-gate/SKILL.md`) lists each reviewer, its model, and how to run it. The model rule is in [Parallel agents](parallel-agents.md#models).

The author checks each finding against the code and fixes the valid ones. Findings the author disagrees with are answered with evidence in the PR body, never dropped silently. The PR body gets a **Review** section, one line per reviewer, that marks each finding as fixed, declined (and why), or filed (with an issue link).

Anything that needs Eli's decision gets the `needs-eli` label. The coordinator asks him as [Talking to Eli](coordinator.md#6-talking-to-eli) says.

### Where the gate lives

- **Reviewer instructions:** `.agents/skills/review-gate/`. `SKILL.md` says how to run the gate. `reviewers/*.md` holds one prompt per reviewer, and `reviewers/_protocol.md` the steps they share. Cursor, Codex, Gemini CLI, and Copilot read `.agents/skills/`. Claude Code reads it through the symlink `.claude/skills/review-gate`.
- **Claude Code reviewer agents:** `.claude/agents/review-*.md`. Each pins its model and points at its prompt in the skill. Cursor reads these files too.
- **Hook:** `scripts/agent-hooks/review-gate-policy.mjs` holds the rules, with no I/O. `scripts/agent-hooks/review-gate-bypass.mjs` holds the [merge bypass](#merges-that-bypass-branch-protection) rules. `scripts/agent-hooks/shell-parse.mjs` finds the commands in a shell script. `scripts/agent-hooks/gh-flags.mjs` reads a gh command's flags as gh does, for both. `scripts/agent-hooks/review-gate.mjs` reads each tool's input, git, and files, and writes each tool's output. Tests: `scripts/agent-hooks/review-gate-hook.test.ts`, `scripts/agent-hooks/review-gate-policy.test.ts`, `scripts/agent-hooks/review-gate-bypass.test.ts`, `scripts/agent-hooks/gh-flags.test.ts`, and `scripts/agent-hooks/shell-parse.test.ts`.

### How the gate is enforced

GitHub cannot tell whether an AI ran the reviewers, so the gate lives in each agent's own hooks, not in CI. It is a guardrail against skipping the review, not a lock: an agent that sets out to get past it can, for example by running a script file that opens the PR.

| Tool           | Hook config                      |
| -------------- | -------------------------------- |
| Claude Code    | `.claude/settings.json`          |
| Codex          | `.codex/hooks.json`              |
| Gemini CLI     | `.gemini/settings.json`          |
| Cursor         | `.cursor/hooks.json`             |
| GitHub Copilot | `.github/hooks/review-gate.json` |

Every tool gets the Review section check. Claude Code also checks reviewer runs and model overrides. A test checks each hook config against the hook's tool table.

- **What counts as opening a PR:** `gh pr create` or `gh pr new`, a POST to `gh api repos/.../pulls`, a `createPullRequest` GraphQL mutation (inline or read from a file), and any MCP tool named `create_pull_request` (not `create_pull_request_review`). The hook parses the shell command, so it finds these after `&&`, env prefixes, wrappers such as `sudo` and `timeout`, `bash -c`, `eval`, and `$(...)`. It ignores them inside quotes, comments, and heredoc bodies. `--help` and `--dry-run` pass, but not `--dry-run=false` or a value built at run time (`--dry-run="$X"`). The hook reads gh's flags as gh does.
- **What it does not catch (when opening a PR):** commands built from variables (`$CMD`), `$'...'` strings, scripts piped into a shell or fed to one as a heredoc, and script files that open a PR. These take a deliberate effort to get around the gate.
- **Review section:** the PR body must be a file passed with `--body-file`, or the `body` of an MCP call. Its `## Review` section needs a filled line for each reviewer label in `.github/pull_request_template.md`. Relative paths resolve after the `cd` commands at the start of the script, absolute or relative. A `cd` the hook cannot follow, such as `cd "$DIR"`, needs an absolute body path. A test fails if the template, the skill's reviewer table, the Claude agent files, and the hook's reviewer list drift apart.
- **Reviewer runs (Claude Code only):** when a `review-*` agent finishes with a report, a `SubagentStop` hook records the commit it reviewed in `.git/review-gate/<branch>/<agent>.json`. A reviewer run in the background hands its report back with a tool call instead of a last message, so the hook reads that report from the agent's transcript. The branch is the one checked out where the session runs, so run the reviewers from a session in the PR's worktree. The PR is blocked until every reviewer has a run on a commit that is on the PR branch and not already on the base. Fix commits made after the review still count. Amending, squashing, or rebasing past the reviewed commit does not, so reviewers run again after a rebase (see [One branch, one PR](git-workflow.md#one-branch-one-pr)). The rule checks that a review happened on the branch, not that it covered every later commit. A reviewer started with a `model` parameter is blocked, so its agent file's model always wins. Other tools cannot run the Claude agent files, so they get the Review section check only.
- **Failures:** input the hook cannot parse passes through, so a broken hook never locks an agent out of the shell. Once a call is known to open a PR, any error blocks it.
- Humans are not blocked. The hooks run only inside AI agents.

### Merges that bypass branch protection

Every tool's hook refuses these shell commands, in any repo, whatever the PR's Review section says:

- `gh pr merge` with `--admin`, in any position or spelling (`--admin=true`, even `--admin=false`), also inside `eval`, `bash -c`, `$(...)`, a pipe or heredoc into a shell or an interpreter, `python3 -c`, a shell `alias`, `gh alias set`, `git -c alias.<x>=...`, or any other program whose words run gh (`find -exec`, `pnpm exec`). `--admin` merges past required checks and branch rules.
- A REST merge: `gh api`, `curl`, `wget`, `http` or `xh` writing to a PR's `pulls/<N>/merge`. That endpoint skips the branch protection check that `gh pr merge` makes, so with admin rights it is the same bypass. A read (`gh api repos/o/r/pulls/5/merge`) passes.

It also refuses merge forms it cannot read, because they may hide `--admin` or a REST merge. Write the command out in full:

- A `gh pr merge` word the shell builds at run time that is not a flag's value (`gh pr merge 5 $FLAGS`, `"$N"`), or a flag value the shell splits (`-t $T`, `-t $(cat f)`, `"$@"`, `"${a[@]}"`, zsh's `"${=x}"`), or a brace expansion (`--{admin,rebase}`). A quoted value (`--body "$B"`) passes. `--help=false` is not help: the merge runs, so it is checked.
- A flag before the `gh` subcommand (`gh -R o/r pr merge 5`), or before the `pr` action (`gh pr -t x merge 5`). `-R` and `--repo` between `pr` and the action (`gh pr -R o/r merge 5`) still pass.
- A `gh api` run-time word that may carry a flag (`gh api repos/o/r/pulls/5/merge $X`, an unquoted `repos/o/r/pulls/$N`; quote it), and a `gh api` write whose endpoint ends in a run-time word.

Text that only names `--admin` passes when a program that just prints or searches holds it (`echo`, `git commit -m`, `grep`). When a shell with no `-c`, an interpreter, or a program built at run time (`"$X"`) is in the command, the hook checks the whole command's text, so a commit message there that names `--admin` and `merge` is refused too: run it in its own call. Not caught: a merge through an MCP tool, a GraphQL `mergePullRequest` mutation, an HTTP client whose URL is a variable, and a script file. When a plain `gh pr merge` is refused, see [Merge](#merge).

## Right before the PR

Read what landed on `main` since you branched:

```bash
git fetch origin && git log --oneline HEAD..origin/main
```

- If it touches your work, catch up as [One branch, one PR](git-workflow.md#one-branch-one-pr) says, and run the gates again.
- If it already solves your problem, stop and say so.

## Merge

- The coordinator merges on green, without a "merge N" from Eli: a clean CI run on the PR's exact head commit (`quality` is the required check; "no checks reported" is not a pass, and a pass on an older head does not count), and the local checks passing in the PR's worktree, run by the agent that owns it. It asks Eli, as [Talking to Eli](coordinator.md#6-talking-to-eli) says, only when a check is red, skipped for an odd reason, or failing locally. A red `Visual` run is settled as [Visual regression](visual-regression.md) says.
- Merge with `gh pr merge <N> --rebase`, or `--squash` for a branch with a merge commit from `main`. See [Git workflow](git-workflow.md#merge-method-rebase-by-default-squash-for-a-merge-commit).
- Branch protection is never bypassed: never add `--admin`, and never merge another way, such as a REST merge. If GitHub refuses a merge because a check fails or a branch rule blocks it, stop and ask Eli in chat, and say what blocks it. He can fix the check or the rule, or merge the PR himself. The hook refuses both bypasses: see [Merges that bypass branch protection](#merges-that-bypass-branch-protection).

## After merge

1. Tell Eli in one or two lines, with the head commit you merged.
2. Comment a short summary on the issue.
3. Repoint any screenshot links to the landed commit. See [Git workflow](git-workflow.md).
4. Clean up, from the main checkout. `<name>` is the worktree folder: the branch name without its `type/` prefix. See [Parallel agents](parallel-agents.md).

   The [main checkout guard](git-workflow.md#the-main-checkout-guard) refuses `git worktree remove` there. This is the one routine use of its escape:

```bash
ALLOW_MAIN_CHECKOUT_WRITE=1 git worktree remove .claude/worktrees/<name>
git branch -D <branch>
git push origin --delete <branch>
```
