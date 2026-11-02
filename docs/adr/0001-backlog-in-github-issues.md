# The backlog is GitHub Issues only

We kept work in two places: GitHub Issues and a separate kanban board. On 2026-11-01 we made GitHub Issues the only backlog. We deleted every rule for the old board from the repo.

GitHub Issues won for three reasons:

- A PR closes its issue on merge.
- Agents read and write issues with `gh`.
- GitHub has native blocked-by and sub-issue links.

## Considered options

- **Keep the old board.** Rejected. Its dependencies lived in prose in each card. No PR closed a card. Two backlogs drifted apart.
- **A relations add-on for the old board.** Rejected. The board's MCP server cannot read add-on data, so no agent could use it.
