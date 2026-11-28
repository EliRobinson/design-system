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

- **What counts as opening a PR:** `gh pr create` or `gh pr new`, a POST to `gh api repos/.../pulls`, a `createPullRequest` GraphQL mutation (inline or read from a file), and any MCP tool named `create_pull_request` (not `create_pull_request_review`). The hook parses the shell command, so it finds these after `&&`, env prefixes, wrappers such as `sudo` and `timeout`, `bash -c`, `eval`, `coproc`, `$(...)`, a process substitution (`<(...)`, `>(...)`), and zsh's `=gh` (the program `gh` from the PATH), and in the `e` string of a zsh glob qualifier (`ls *(e:'...':)`), which zsh runs as shell code. It ignores them inside quotes, comments, and heredoc bodies. `--help` and `--dry-run` pass, but not `--dry-run=false` or a value built at run time (`--dry-run="$X"`). The hook reads gh's flags as gh does. A gh command or `pr` action it cannot read is refused: see [gh commands the hook cannot read](#gh-commands-the-hook-cannot-read).
  - The `e` string is read with any delimiter and quotes (`e:"...":`, `e[...]`, `e{...}`), after other qualifiers (`*(.oe:'...':)`), and after another group (`(a|b)(e:'...':)`). A group nested in another group's `e` string is read through that string.
  - The limits:
    - Past 5 levels of nested `eval`, `bash -c` and `e` strings together, the inner script is not read at all (#480). An `e` string at that depth counts as built at run time.
    - An `e` string past 10,000 commands in all the `e` strings one call reads, nested ones counted again at each level, counts as built at run time.
    - So does a glob group nested more than 32 deep in another.
    - A process substitution nested past 32 levels of `$(...)`, backticks and process substitutions counts as built at run time. The commands inside it are still read. Only a process substitution falls back like this: a `$(...)` or backtick nested some thousands deep overflows the parser's stack, and the hook lets the call through (#485).
- **What it does not catch (when opening a PR):** a program name built from a variable (`$CMD pr create`), the zsh glob qualifiers below, `$'...'` strings outside a `gh api` write's endpoint (there they are refused, see [gh commands the hook cannot read](#gh-commands-the-hook-cannot-read)), scripts piped into a shell or fed to one as a heredoc, and script files that open a PR. These take a deliberate effort to get around the gate.
  - A command zsh runs from a glob qualifier the hook cannot read: `*(+fn)` calls `fn`, and `*($Q)` and `*(e:"$X":)` build the qualifier at run time.
  - zsh's inline qualifier `*(#qe:'...':)`, whose `#` the hook reads as a comment to the end of the line (#478).
  - A plain `eval` or `bash -c` nested past 5 levels: it is not read at all, and does not count as built at run time (#480).
  - A very large or deeply nested glob group, past the 10,000-command or 32-deep limits above. It counts as built at run time and is not read for PR opens; the merge checks still read the whole command's text.
- **Review section:** the PR body must be a file passed with `--body-file`, or the `body` of an MCP call. Its `## Review` section needs a filled line for each reviewer label in `.github/pull_request_template.md`. A body file whose path the shell builds at run time (`--body-file "$F"`, `--body-file <(...)`) or a glob (`--body-file b*.md`) is refused, since the hook cannot read the file gh reads. Relative paths resolve after the `cd` commands at the start of the script, absolute or relative. When the hook cannot tell which folder `gh pr create` runs in, after a `cd` it cannot follow (`cd "$DIR"`, or a `cd` inside `{ ... }`), it refuses the PR even with an absolute body path, because it reads the reviewer runs from that folder too. Write the `cd` out, or run `gh pr create` from the PR's worktree. With no `cd` at all, the command runs in the hook's working directory. A relative graphql query file after such a `cd` is refused too. A `cd` in a subshell, a background job or a `coproc` moves only that shell: see [How it finds the folder](git-workflow.md#how-it-finds-the-folder). A test fails if the template, the skill's reviewer table, the Claude agent files, and the hook's reviewer list drift apart.
- **Reviewer runs (Claude Code only):** when a `review-*` agent finishes with a report, a `SubagentStop` hook records the commit it reviewed in `.git/review-gate/<branch>/<agent>.json`. A reviewer run in the background hands its report back with a tool call instead of a last message, so the hook reads that report from the agent's transcript. The branch is the one checked out where the session runs, so run the reviewers from a session in the PR's worktree. The PR is blocked until every reviewer has a run on a commit that is on the PR branch and not already on the base. Fix commits made after the review still count. Amending, squashing, or rebasing past the reviewed commit does not, so reviewers run again after a rebase (see [One branch, one PR](git-workflow.md#one-branch-one-pr)). The rule checks that a review happened on the branch, not that it covered every later commit. A reviewer started with a `model` parameter is blocked, so its agent file's model always wins. Other tools cannot run the Claude agent files, so they get the Review section check only.
- **Failures:** stdin that is not a JSON object passes through. Any other error while the hook reads a call, such as the shell parser throwing, blocks it with "The hook failed": a call the parser cannot read may hide a PR open or a merge bypass. If that happens, file an issue with the shape of the command, never secrets.
- Humans are not blocked. The hooks run only inside AI agents.

### Merges that bypass branch protection

Every tool's hook refuses these shell commands, in any repo, whatever the PR's Review section says:

- `gh pr merge` with `--admin`, in any position or spelling (`--admin=true`, even `--admin=false`), also inside `eval`, `bash -c`, `$(...)`, a process substitution (`<(...)`, `>(...)`), zsh's `=gh`, a zsh glob qualifier's `e` string (`ls *(e:'...':)`), a pipe or heredoc into a shell or an interpreter, `python3 -c`, a shell `alias`, `gh alias set`, `git -c alias.<x>=...`, or any other program whose words run gh (`find -exec`, `pnpm exec`). `--admin` merges past required checks and branch rules.
- A REST merge: `gh api`, `curl`, `wget`, `http`, `https`, `xh` or `xhs` writing to a PR's `pulls/<N>/merge`. That endpoint skips the branch protection check that `gh pr merge` makes, so with admin rights it is the same bypass. A read (`gh api repos/o/r/pulls/5/merge`) passes. An HTTP client write (a method built at run time, as in `-X "$M"` or httpie's `http "$M" <url>`, any method but GET or HEAD, or a body) to a URL the shell builds at run time is refused too when it may be the GitHub API, since it may become that path: one that names `api.github.com` or GitHub Enterprise's `/api/v3` (`curl -X PUT .../pulls/5/m*`, `.../pul[l]s/5/merge`, `".../repos/o/r/$P"`), or, in the URL's place, one whose host has a run-time part and is not exactly one variable (`https://api.$D/...`, `api.github.c[o]m`; credentials such as `user:$PW@host` count as part of the host). Write the URL out in full. An unquoted `?` counts too, so quote a write's query string. A read with one (`curl .../pulls/5/files?page=2`) passes. Every word, a body or flag value too, is read for a GitHub API name, so a write whose body names the API with a run-time part is refused as well; the run-time host check reads only the words in the URL's place.

It also refuses merge forms it cannot read, because they may hide `--admin` or a REST merge. Write the command out in full:

- A `gh pr merge` word the shell builds at run time that is not a flag's value (`gh pr merge 5 $FLAGS`, `"$N"`), or a flag value the shell splits (`-t $T`, `-t $(cat f)`, `"$@"`, `"${a[@]}"`, zsh's `"${=x}"`), or a brace expansion (`--{admin,rebase}`), or an unquoted filename pattern (`--admi[n]`, `--admi[" "n]`, `--admin*`, `*`, a glob group `--admi(n|x)`, `--admi@(n)` or zsh's `(--admin|x)`), which a file of that name turns into a flag. A quoted value (`--body "$B"`, `-t 'fix?'`) passes. `--help=false` is not help: the merge runs, so it is checked.
- A flag before the `gh` subcommand (`gh -R o/r pr merge 5`), or before the `pr` action (`gh pr -t x merge 5`). `-R` and `--repo` between `pr` and the action (`gh pr -R o/r merge 5`) still pass.
- A `gh api` run-time word that may carry a flag (`gh api repos/o/r/pulls/5/merge $X`, an unquoted `repos/o/r/pulls/$N`; an unquoted `?` in a URL, as in `pulls?state=open`; quote it), and a `gh api` write whose endpoint holds a run-time word (see [gh commands the hook cannot read](#gh-commands-the-hook-cannot-read)).

Text that only names `--admin` passes when a program that just prints or searches holds it (`echo`, `git commit -m`, `grep`). When a shell with no `-c`, an interpreter, or a program built at run time (`"$X"`, a zsh `=` word the hook cannot read such as `=a/gh` or `=cd`, or a zsh glob qualifier the hook cannot read: `*(+fn)`, `*($Q)`, `*(e:"$X":)`) is in the command, the hook checks the whole command's text, so a commit message there that names `--admin` and `merge` is refused too: run it in its own call. Not caught: a merge through an MCP tool, a GraphQL `mergePullRequest` mutation, an HTTP client whose URL or host is one variable or a run of variables with nothing between them (`curl -X PUT $URL`, `"$API_URL/users"`, `$H$P`, `"$BASE$PATH"`; a port such as `localhost:$PORT` does not count), and a script file. When a plain `gh pr merge` is refused, see [Merge](#merge).

### gh commands the hook cannot read

Every tool's hook refuses these, whether the command opens a PR or merges one. A word the shell builds at run time where gh reads its command or the `pr` action may become `gh pr create`, which skips the review, or `gh pr merge --admin`. So the hook refuses:

- A run-time command or action: `gh $X`, `gh pr $X`, `gh pr "$X"`, `gh pr $(...)`, `gh pr $'merge'`.
- An unquoted filename pattern there: `gh pr cre*`, `gh p[r] create`, a glob group `gh pr merg(e)`. A file named `create` turns it into `create`.
- A `-R` or `--repo` value the shell splits, before the command or the action: `gh -R $X create`, `gh --repo=$X create`, `gh pr -R $X view`. `X='o/r pr'` makes the command `pr`. Quote it: `gh pr -R "$R" view` passes.
- A flag built at run time before the command or the action: `gh -$X o/r create`, `gh pr "-$X" o/r view`.
- Either of these after another flag that may take the next word as its value: `gh -t T -R $X create`, `gh --foo x -$X create`.

A run-time word after a literal action other than `merge` passes: `gh pr view $N`, `gh issue view $N`. For `gh pr merge`, see [Merges that bypass branch protection](#merges-that-bypass-branch-protection).

A `gh api` write to an endpoint built at run time is refused too. It may go to `repos/<o>/<r>/pulls`, which opens a PR, or to `pulls/<N>/merge`, which merges one. This holds wherever the run-time part stands: `gh api -X POST "repos/$R/pulls"`, `gh api "repos/o/r/pulls/$N" -X PATCH`, `gh api "$E" -f x=y`. A write is `-X` or `--method` with any method but `GET` or `HEAD`, a method built at run time (`-X "$M"`), or no method with `-f`, `-F`, `--field`, `--raw-field` or `--input`, which make it a POST. Any other write to a run-time endpoint, such as an issue comment, is refused too, because the hook cannot tell where it goes. Write the endpoint out in full. A read with a run-time endpoint passes: `gh api "repos/$R/pulls"`, `gh api -X GET "repos/$R/pulls"`.

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
