---
name: review-gate
description: Run the pre-PR review gate. Use before opening any pull request, when asked to review a branch before a PR, or when a hook blocks `gh pr create` for a missing Review section. Runs the read-only reviewers on the branch diff and fills the PR body's Review section.
---

# Pre-PR review gate

Run this before you open a pull request. The rules live in `docs/agents/git-and-prs.md`.

## 1. Run the reviewers

Run every reviewer on the branch diff, in parallel if your tool can. None of them edits code. A test keeps this table, the Claude agent files, and the hook's reviewer list in step.

| Reviewer             | Claude agent          | Instructions                | Model  |
| -------------------- | --------------------- | --------------------------- | ------ |
| Code quality         | `review-code-quality` | `reviewers/code-quality.md` | opus   |
| Correctness          | `review-correctness`  | `reviewers/correctness.md`  | opus   |
| Spec, security, copy | `review-spec`         | `reviewers/spec.md`         | sonnet |
| DRY                  | `review-dry`          | `reviewers/dry.md`          | opus   |

The model rule is in `docs/agents/git-and-prs.md`.

- **Claude Code:** start one `review-*` agent per reviewer with the Agent tool. Do not pass a `model`; each agent file pins its own.
- **Other tools:** start one subagent per reviewer with its instructions file. If your tool has no subagents, run each reviewer yourself, one at a time, and keep their findings apart.

## 2. Act on the findings

Handle each finding as `docs/agents/git-and-prs.md` says: fix it, decline it with evidence, or file it.

## 3. Open the PR

1. Write the PR body to a file, in its own step. Fill each reviewer line of the `## Review` section in `.github/pull_request_template.md` with that reviewer's findings: fixed, declined (and why), or filed (with an issue link).
2. Run `gh pr create --body-file <path>`.

Hooks check the PR before it opens. `docs/agents/git-and-prs.md` lists what they check.
