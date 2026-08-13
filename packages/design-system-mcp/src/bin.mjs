#!/usr/bin/env node
/* stdout is the JSON-RPC channel: a single console.log anywhere in this
 * process — or in a dependency — emits a line the host cannot parse and the
 * connection drops. Log to console.error only (enforced by the mcp-stdio
 * eslint config). */

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { createServer } from './server.mjs';

serveStdio(createServer, {
  onerror: (error) => console.error('[design-system-mcp]', error),
});
