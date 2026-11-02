# Backlog

The backlog is GitHub Issues on `EliRobinson/design-system`. Nothing else is the record.

## Every piece of work is an issue

- A PR body says `Closes #N`. The merge closes the issue.
- When you see work you will not do now, open an issue before you finish your task. Not a TODO. Not a note in a PR.
- New facts go in a comment. Do not rewrite the issue body.

## Labels

Every issue has:

- **One type:** `bug`, `enhancement`, `chore`, `documentation`, `qa`, `security`.
- **One priority:** `P1`, `P2`, `P3`.
- **Every area that applies:**

| Label                | Path                                         |
| -------------------- | -------------------------------------------- |
| `area:tokens`        | `packages/tokens/`                           |
| `area:react`         | `packages/react/`                            |
| `area:ai-elements`   | `packages/ai-elements/`                      |
| `area:ai-patterns`   | `packages/ai-patterns/`                      |
| `area:eslint-config` | `packages/eslint-config/`                    |
| `area:mcp`           | `packages/design-system-mcp/`                |
| `area:create`        | `packages/create-elirobinson-design-system/` |
| `area:docs-site`     | `apps/docs/`                                 |
| `area:storybook`     | `apps/storybook/`                            |
| `area:ci`            | `.github/`, `scripts/`, `nx.json`, hooks     |

The visual labels (`visual`, `visual-accept`, `visual-baseline`) keep their own meaning. See [Visual regression](visual-regression.md).

## Triage labels: may an agent pick it up?

| Label                 | Meaning                                     |
| --------------------- | ------------------------------------------- |
| none                  | Ready. An agent may take it.                |
| `in-progress`         | An agent owns it. Hands off.                |
| `needs-decision`      | Waits on a design or scope decision.        |
| `needs-eli`           | Waits on Eli. The ask is on his board.      |
| `human-only`          | Only Eli does this.                         |
| `blocked`             | Waits on another issue. Link it.            |
| `shared-append-point` | Touches a shared file. One agent at a time. |

Shared append points in this repo: `AGENTS.md`, root `package.json`, `nx.json`, `pnpm-workspace.yaml`, `.github/workflows/`.

Before you take an issue, check open PRs too (`gh pr list`). Sessions run in parallel. A PR may already do it.

## Order and epics use GitHub links

Use GitHub's native **blocked by** and **sub-issue** links. Never write a dependency in prose.

Both APIs take the issue's id, not its number:

```bash
gh api repos/EliRobinson/design-system/issues/<N> --jq .id
```

Mark `<N>` as blocked by another issue:

```bash
gh api -X POST repos/EliRobinson/design-system/issues/<N>/dependencies/blocked_by -F issue_id=<blocker id>
```

Add a sub-issue to an epic:

```bash
gh api -X POST repos/EliRobinson/design-system/issues/<epic N>/sub_issues -F sub_issue_id=<child id>
```

## A good issue

A fresh agent must be able to start cold. Write:

- What and why.
- The repo paths it touches.
- What "done" looks like, as checks someone can run.
- What was ruled out, and why.
- Facts that took effort to measure, with the command that measured them.
