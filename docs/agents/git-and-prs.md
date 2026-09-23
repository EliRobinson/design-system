# Git, hooks, and pull requests

## Review gate (before a PR is opened)

Before a PR is opened, read-only reviewers run on the branch diff. The `review-gate` skill (`.agents/skills/review-gate/SKILL.md`) lists each reviewer, its model, and how to run it. Reviewers run on Opus, Sonnet, or Haiku only, never Fable. Fable costs too many tokens.

The author checks each finding against the code and fixes the valid ones. Findings the author disagrees with are answered with evidence in the PR body, never dropped silently. The PR body gets a **Review** section, one line per reviewer, that marks each finding as fixed, declined (and why), or filed (with an issue link).

### Where the gate lives

- **Reviewer instructions:** `.agents/skills/review-gate/`. `SKILL.md` says how to run the gate. `reviewers/*.md` holds one prompt per reviewer, and `reviewers/_protocol.md` the steps they share. Cursor, Codex, Gemini CLI, and Copilot read `.agents/skills/`. Claude Code reads it through the symlink `.claude/skills/review-gate`.
- **Claude Code reviewer agents:** `.claude/agents/review-*.md`. Each pins its model and points at its prompt in the skill. Cursor reads these files too.
- **Hook:** `scripts/agent-hooks/review-gate-policy.mjs` holds the rules, with no I/O. `scripts/agent-hooks/shell-parse.mjs` finds the commands in a shell script. `scripts/agent-hooks/review-gate.mjs` reads each tool's input, git, and files, and writes each tool's output. Tests: `scripts/agent-hooks/review-gate-hook.test.ts`, `scripts/agent-hooks/review-gate-policy.test.ts`, and `scripts/agent-hooks/shell-parse.test.ts`.

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

- **What counts as opening a PR:** `gh pr create` or `gh pr new`, a POST to `gh api repos/.../pulls`, a `createPullRequest` GraphQL mutation (inline or read from a file), and any MCP tool named `create_pull_request` (not `create_pull_request_review`). The hook parses the shell command, so it finds these after `&&`, env prefixes, wrappers such as `sudo` and `timeout`, `bash -c`, `eval`, and `$(...)`. It ignores them inside quotes, comments, and heredoc bodies. `--help` and `--dry-run` pass.
- **What it does not catch:** commands built from variables (`$CMD`), `$'...'` strings, scripts piped into a shell or fed to one as a heredoc, and script files that open a PR. These take a deliberate effort to get around the gate.
- **Review section:** the PR body must be a file passed with `--body-file`, or the `body` of an MCP call. Its `## Review` section needs a filled line for each reviewer label in `.github/pull_request_template.md`. Relative paths resolve after the `cd` commands at the start of the script, absolute or relative. A `cd` the hook cannot follow, such as `cd "$DIR"`, needs an absolute body path. A test fails if the template, the skill's reviewer table, the Claude agent files, and the hook's reviewer list drift apart.
- **Reviewer runs (Claude Code only):** when a `review-*` agent finishes with a report, a `SubagentStop` hook records the commit it reviewed in `.git/review-gate/<branch>/<agent>.json`. The PR is blocked until every reviewer has a run on a commit that is on the PR branch and not already on the base. Fix commits made after the review still count. Amending, squashing, or rebasing past the reviewed commit does not, so reviewers run again after a rebase. The rule checks that a review happened on the branch, not that it covered every later commit. A reviewer started with a `model` parameter is blocked, so its agent file's model always wins. Other tools cannot run the Claude agent files, so they get the Review section check only.
- **Failures:** input the hook cannot parse passes through, so a broken hook never locks an agent out of the shell. Once a call is known to open a PR, any error blocks it.
- Humans are not blocked. The hooks run only inside AI agents.
