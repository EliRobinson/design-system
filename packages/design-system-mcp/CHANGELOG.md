# @elirobinson/design-system-mcp

## 0.1.0

### Minor Changes

- 242fbe0: First release: an MCP server over the installed design-system packages, on `@modelcontextprotocol/server` v2 (`serveStdio` factory wiring). Five tools — `get_component` (props, sub-components, and constraints in one call), `search_tokens`, `get_constraints`, `get_brand_guidance`, `check_adherence` — plus the brand voice and contract set mirrored as resources. Everything reads the consumer's `node_modules` and never the network, so it cannot go stale; every failure message enumerates the valid alternatives so an agent can retry.
