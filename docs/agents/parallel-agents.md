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
