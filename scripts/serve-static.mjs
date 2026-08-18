#!/usr/bin/env node
/* Serves a directory over HTTP for the visual suite's Playwright `webServer`.

   Written out rather than pulled in because the alternative is a dependency
   whose only job is 40 lines of `fs.createReadStream`, and because a static
   server that behaves identically on a laptop and inside the container is
   worth more here than one with features. The docs project uses `next start`
   instead — it needs Next's routing, not a file server.

   Usage: node scripts/serve-static.mjs <dir> <port>
*/

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import process from 'node:process';

const [dirArg, portArg] = process.argv.slice(2);

if (!dirArg || !portArg) {
  process.stderr.write('Usage: node scripts/serve-static.mjs <dir> <port>\n');
  process.exit(1);
}

const root = resolve(dirArg);
const port = Number(portArg);

if (!existsSync(root)) {
  /* The common cause is running the suite without building first, which
     otherwise shows up as an opaque Playwright webServer timeout. */
  process.stderr.write(
    `Nothing to serve: ${root} does not exist.\n` +
      'Build it first — `pnpm test:visual` does this for you.\n',
  );
  process.exit(1);
}

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);

  /* normalize collapses `..` before the prefix check, so a crafted path cannot
     escape the served directory. */
  const candidate = normalize(join(root, requestPath));

  if (!candidate.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  const target =
    existsSync(candidate) && statSync(candidate).isDirectory()
      ? join(candidate, 'index.html')
      : candidate;

  if (!existsSync(target)) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': MIME[extname(target)] ?? 'application/octet-stream',
    /* The suite must never compare against a stale asset from a previous
       build sitting in the browser's cache. */
    'Cache-Control': 'no-store',
  });

  createReadStream(target).pipe(response);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`serving ${root} at http://127.0.0.1:${port}\n`);
});
