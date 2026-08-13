/* Packaging layer: exactly one spawned-stdio smoke test. It is the only thing
 * that catches a broken shebang, a missing executable bit, or a stray
 * console.log — none of which the in-process harness can see. The bin file
 * itself is executed (not `node bin`), so the shebang and mode are on trial.
 *
 * Every stdout line must parse as JSON-RPC: stdout is the protocol channel,
 * and one unparseable line from anywhere in the process is a dropped
 * connection in a real host. */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const bin = join(dirname(fileURLToPath(import.meta.url)), 'bin.mjs');

it('serves initialize → tools/list over stdio, emitting only JSON on stdout', async () => {
  const child = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  const stdout = [];
  let stderr = '';
  let buffered = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const responses = new Map();
  const waiters = new Map();
  child.stdout.on('data', (chunk) => {
    buffered += chunk;
    let index;
    while ((index = buffered.indexOf('\n')) !== -1) {
      const line = buffered.slice(0, index);
      buffered = buffered.slice(index + 1);
      if (line.trim() === '') {
        continue;
      }
      stdout.push(line);
      /* The whole point: a stray console.log fails right here. */
      const message = JSON.parse(line);
      if (message.id !== undefined) {
        responses.set(message.id, message);
        waiters.get(message.id)?.(message);
      }
    }
  });

  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const response = (id) =>
    responses.get(id) ??
    new Promise((resolvePromise, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no response to request ${id}; stderr: ${stderr || '(empty)'}`)),
        30_000,
      );
      waiters.set(id, (message) => {
        clearTimeout(timer);
        resolvePromise(message);
      });
    });

  try {
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'stdio-smoke', version: '0.0.0' },
      },
    });
    const initialized = await response(1);
    expect(initialized.result.serverInfo.name).toBe('miltinson-design-system');

    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = await response(2);
    expect(tools.result.tools.map((tool) => tool.name)).toContain('get_component');

    expect(stdout.length).toBeGreaterThanOrEqual(2);
  } finally {
    child.kill();
  }
}, 45_000);
