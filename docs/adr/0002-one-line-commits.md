# Commit messages are one line, with no body and no trailers

From 2026-11-01 every commit is a single Conventional Commit line. Earlier commits had a body and a `Co-Authored-By` trailer. The why and the proof now live in the issue and the PR. Reviewers already read them there.

The `commit-msg` hook (`scripts/git-hooks/commit-policy.mjs`) enforces the rule. A tool that adds a trailer by default fails the commit and must drop it.

## Consequences

- Git writes merge and `fixup!` subjects itself, so they pass.
- Git's sequencer (`git revert`, `rebase -i` squash, and `git cherry-pick` without an editor) skips the hooks. So the `quality` job checks every commit a pull request adds, with the same rule (#278). Git's own `Revert "..."` subject fails there. Write `revert: <subject>`.
- Merge commits are not checked in CI. Main takes rebase-merges only, so none lands there.
- CI bot commits use one `-m` only. A test in `scripts/git-hooks/commit-policy.test.mjs` reads every `git commit` in `.github/workflows/` and checks its message.
