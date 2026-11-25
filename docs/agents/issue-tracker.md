# Ticketing tool

This file is the repo's one setting for where tickets live. The `agent-roster` agents read it before they search, view, file, edit, close or link a ticket, and use only the commands below. When to file an issue, its labels and its links are in [Backlog](backlog.md).

## Setting

- **Tool:** GitHub Issues
- **Access:** cli
- **Ticket ID:** `#123`
- **In branch names:** `123`, as in `chore/123-short-description`
- **Link:** `https://github.com/EliRobinson/design-system/issues/<id>`
- **Close from a PR:** `Closes #<id>` in the PR body

**Access** is `cli` or `mcp`. It picks a column of the table below.

## Commands

`<not set>` means the action has no command for that access yet. Never guess a command.

| Action  | `cli`                                                     | `mcp`       |
| ------- | --------------------------------------------------------- | ----------- |
| Search  | `gh issue list --search '<words>' --state all`            | `<not set>` |
| View    | `gh issue view <id> --comments`                           | `<not set>` |
| Create  | `gh issue create --title '<title>' --body-file <file>`    | `<not set>` |
| Edit    | `gh issue edit <id> --title '<title>' --body-file <file>` | `<not set>` |
| Comment | `gh issue comment <id> --body-file <file>`                | `<not set>` |
| Label   | `gh issue edit <id> --add-label '<label>'`                | `<not set>` |
| Close   | `gh issue close <id> --comment '<why>'`                   | `<not set>` |

## Rules

- File, search, edit and close tickets only here, with the commands above.
- Filing follow-up work needs no yes from Eli: [Backlog](backlog.md) says to file it before you finish.
- Put every value in a command inside single quotes. Write a `'` inside a value as `'\''`. Or pass the text from a file (`--body-file`). Never put report, note or finding text inside double quotes, because the shell runs `$(...)` and backticks there.
- A review finding filed as a ticket is marked filed, with its issue link, in the PR's `## Review` section.

## When a skill says "publish to the issue tracker"

Create a ticket with the Create command.

## When a skill says "fetch the relevant ticket"

Run the View command.
