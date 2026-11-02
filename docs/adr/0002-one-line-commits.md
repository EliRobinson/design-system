# Commit messages are one line, with no body and no trailers

From 2026-11-01 every commit is a single Conventional Commit line. Earlier commits had a body and a `Co-Authored-By` trailer. The why and the proof now live in the issue and the PR, where reviewers already read them. The `commit-msg` hook (`scripts/git-hooks/commit-policy.mjs`) enforces it, so a tool that adds a trailer by default fails the commit and must drop it.

## Consequences

- `git revert` writes a body by default. Edit the message to one line.
- Merge and `fixup!` messages pass, because git writes them.
