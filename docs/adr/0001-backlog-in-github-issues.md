# The backlog is GitHub Issues, not Trello

We kept work in two places: GitHub Issues and a Trello board. On 2026-11-01 we made GitHub Issues the only backlog and deleted every Trello rule from the repo. A PR closes its issue on merge, agents read and write issues with `gh`, and GitHub has native blocked-by and sub-issue links. Trello needed a hand-written `## Relations` block in each card, because the Trello MCP server has no API for relations.

## Considered options

- **Keep Trello.** Rejected: dependencies lived in prose, no PR closed a card, and two backlogs drifted apart.
- **A Trello relations Power-Up.** Rejected earlier: the MCP server cannot read Power-Up data, so no agent could use it.
