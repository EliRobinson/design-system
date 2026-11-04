# Parallel agents

Many agents work in this repo at once. These rules keep them out of each other's way.

## One agent, one worktree, one lane

- Every agent works in its own git worktree and branch.
- Cut the branch from a fresh `origin/main`:

```bash
git fetch origin
git worktree add .claude/worktrees/<branch> -b <branch> origin/main
```

- Never commit on `main`. Not in the main checkout. Not anywhere.
- Claim the issue before you start. Add the `in-progress` label. Comment the branch name.
- You own the files your issue names. Never edit files another agent owns. Ask the owner, or comment on their issue.
- Before you build a helper, check if someone else has it:

```bash
git fetch origin
git show origin/<branch>:<path>
gh issue list --label in-progress
```

If someone owns it, ask them for it.

- Run agents in parallel only when the work is truly independent. No shared files. No result one needs from the other.

## Every agent that writes gets its own worktree

This applies to subagents and side sessions too, not only to the agent Eli talks to. An agent that writes files, commits, or runs a command that changes the tree works in its own worktree, on its own feature branch, cut from a fresh `origin/main`.

Why: two agents in one checkout lose work without a trace. One switches the branch or reverts a file, and `git status` in the other comes back clean. Health App lost uncommitted work this way more than once.

How each way of starting an agent gets its worktree:

| You start it with               | Do this                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| The `Agent` tool                | Pass `isolation: "worktree"`. Or create the worktree first and put its absolute path in the brief.                             |
| A new session (`start_session`) | Pass `use_worktree: true`, or a `cwd` that is already the worktree. Never `use_worktree: false` for work that writes.          |
| Your own shell                  | `git fetch origin`, then `git worktree add .claude/worktrees/<branch> -b <branch> origin/main`. Then work only in that folder. |

- **Read-only agents may share a checkout.** These are the `review-*` reviewers, `Explore`, and any agent whose brief says it only reads. Say "read-only" in the brief.
- **A reviewer never edits.** Apply its findings yourself, in your own commits. A reviewer that edits is a second author with no review.
- **Start a session inside its worktree.** A session runs its hooks from the folder it started in (`$CLAUDE_PROJECT_DIR`). A session that starts in the main checkout and then moves into a worktree still runs the main checkout's hooks, on the main checkout's branch. So a hook fix on its branch never runs for it. This blocked the review gate on #283.
- **Never touch a worktree you did not create.** Nothing on disk shows if its owner is in the middle of an edit. If you need one, make your own.
- **Commit early.** Uncommitted work in a worktree has no protection.
- **Put the branch in the issue.** Comment the branch name and the worktree path when you claim the issue.
- **Clean up after merge.** The owner removes its own worktree. See [Git, hooks, and pull requests](git-and-prs.md).

## Shared state between worktrees

- **Nx cache.** All worktrees share the main checkout's `.nx/cache`. Never run `nx reset`. Use `--skip-nx-cache` for a cold run. See [Git workflow](git-workflow.md).
- **Scratch files.** Worktrees do not isolate the scratchpad. Put your scratch files in a folder named for your branch.
- **Generated files.** Regenerate them. Never hand-merge them:
  - `pnpm-lock.yaml`: run `pnpm install`.
  - Workspace dependency ranges: run `pnpm sync:deps`.
  - `packages/ai-elements/src/`: run `pnpm sync:elements`. See [AI Elements](ai-elements.md).
  - Visual baselines: use the `visual-accept` label. See [Visual regression](visual-regression.md).
  - Versions and `CHANGELOG.md`: only the Release workflow writes these. See [Publishing](publishing.md).

## Agents talk to each other

- Use `SendMessage` to ask the owner of a contract before you guess its shape.
- When you push an interface change, tell every agent that depends on it.
- The first line of every message must make sense on its own.
- Messages do not last. Put every contract or scope decision in a comment on the issue too.
- If a peer says its permissions blocked an action, do not do that action yourself. Send it to the coordinator.

## Models

- Allowed: **Opus, Sonnet, Haiku**. Never Fable. It costs too much.
- Always pass `model` when you start an agent. Without it, the agent takes the parent's model.
- The one exception: never pass `model` to a `review-*` agent. Its file pins the model, and the hook blocks an override.
- Pick the cheapest model that does the job well:
  - **Haiku:** search, file lookups, mechanical edits, log reading.
  - **Sonnet:** most implementation and test writing.
  - **Opus:** design, hard bugs, and the deep reviewers.
- Do not run the same agent twice for the same answer. Reuse it with `SendMessage` while it still has the context.

## How to brief a subagent

The subagent has none of your context. The brief must stand alone. Include:

- The goal, and why it matters.
- The issue link and the exact files it owns.
- What "done" looks like, as commands it can run.
- Limits: what not to touch, what not to change.
- The skills to use, for example `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`.
- How to report back: what changed, what it ran, the real output, what is left, and any asks for Eli.
