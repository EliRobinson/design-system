# @elirobinson/design-system-mcp

An MCP server over the **installed** Miltinson design system packages. It answers the
question the `elirobinson-ds` CLI answers — _"what does the version I have installed
offer?"_ — to an agent while it writes code, which is the moment the answer matters.

It reads `node_modules` and never the network, so nothing it reports can go stale: bump a
package and every prop table, token, and constraint an agent sees is current. There is no
snapshot to refresh and therefore no `STALE SNAPSHOT` failure class.

## Tools

| Tool                 | Returns                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `get_component`      | Import line, prop tables, sub-components, and applicable constraints — one call |
| `search_tokens`      | Token name, value, resolved value, and comment; filterable by prefix            |
| `get_constraints`    | The machine-checkable UX contracts, scoped by component                         |
| `get_brand_guidance` | Voice rules and the UI-kit pointers for a named surface                         |
| `check_adherence`    | The generated adherence checks, run over a snippet                              |

Brand voice and the full constraint set are also mirrored as resources
(`miltinson://brand/voice`, `miltinson://constraints`) for `@`-mentioning in a review
conversation.

## Wiring it up in a consuming repo

Install it next to the packages it reads (it resolves them from the project it is launched
in):

```bash
pnpm add -D @elirobinson/design-system-mcp
```

Then point `.mcp.json` at the bin with `node` directly — not through `pnpm … exec`, whose
lifecycle output corrupts the stdio JSON-RPC channel:

```json
{
  "mcpServers": {
    "design-system": {
      "command": "node",
      "args": ["node_modules/@elirobinson/design-system-mcp/src/bin.mjs"]
    }
  }
}
```

The package is published to the same restricted GitHub Packages registry as the rest of the
`@elirobinson` scope, so installing it needs the usual `.npmrc` scope mapping and a PAT in
the **user-level** npmrc — the same setup every consumer of this design system already has.
Prefer the devDependency wiring above over `npx -y`: a launch-time registry fetch fails
opaquely in any environment missing that token, while an installed bin never fetches.
