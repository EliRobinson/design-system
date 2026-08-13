/* Assertions layer: a real Client driven against createMcpHandler(createServer)
 * in process — no port, no spawn, no mock. Every test asserts on the resolved
 * value, never through try/catch: a tool failure is a *successful* JSON-RPC
 * result carrying `isError: true`, and a try/catch-based test would pass
 * forever regardless of behaviour. Packaging concerns (shebang, exec bit,
 * stray stdout) live in stdio.smoke.test.mjs — this harness cannot see them. */

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServer } from './server.mjs';

let handler;
let client;

beforeAll(async () => {
  handler = createMcpHandler(createServer);
  const transport = new StreamableHTTPClientTransport(new URL('http://in-process.test/mcp'), {
    fetch: (input, init) => handler.fetch(new Request(input, init)),
  });
  client = new Client({ name: 'design-system-mcp-tests', version: '0.0.0' });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
  await handler.close();
});

const call = (name, args = {}) => client.callTool({ name, arguments: args });
const textOf = (result) => result.content.map((block) => block.text).join('\n');

describe('the tool surface', () => {
  it('offers exactly the five spec tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'check_adherence',
      'get_brand_guidance',
      'get_component',
      'get_constraints',
      'search_tokens',
    ]);
  });
});

describe('get_component', () => {
  it('answers with import line, props, and constraints in one call', async () => {
    const result = await call('get_component', { name: 'Button' });
    expect(result.isError).toBeFalsy();
    const text = textOf(result);
    expect(text).toContain("from '@elirobinson/react/components/atoms/Button'");
    expect(text).toContain('| variant |');
    /* Constraints arrive expanded — id AND summary — so the agent never has
       to make a second call to learn what an id means. */
    expect(text).toContain('touch-target-primary');
    expect(text).toMatch(/touch-target-primary\*\* — \S/);
  });

  it('resolves a slug the same as a name', async () => {
    const result = await call('get_component', { name: 'date-picker' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('DatePicker');
  });

  it('enumerates the real components on a miss, so the model can retry', async () => {
    const result = await call('get_component', { name: 'DataGrid' });
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('No component "DataGrid"');
    expect(text).toContain('Button');
    expect(text).toContain('VirtualTable');
  });
});

describe('search_tokens', () => {
  it('filters by prefix, with or without the -- spelling', async () => {
    for (const prefix of ['ink', '--ink-']) {
      const result = await call('search_tokens', { prefix, limit: 50 });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('--ink-0');
      expect(textOf(result)).not.toContain('--signal-');
    }
  });

  it('truncates at the limit and says how much more there is', async () => {
    const result = await call('search_tokens', { prefix: 'ink', limit: 3 });
    expect(textOf(result)).toMatch(/… \d+ more/);
  });

  it('names the real prefixes on a miss', async () => {
    const result = await call('search_tokens', { query: 'brand-primary' });
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('Prefixes:');
    expect(text).toContain('--ink-');
    expect(text).toContain('--signal-');
  });
});

describe('get_constraints', () => {
  it('scopes to one component', async () => {
    const result = await call('get_constraints', { component: 'button' });
    expect(result.isError).toBeFalsy();
    const text = textOf(result);
    expect(text).toContain('apply to Button');
    expect(text).toContain('touch-target-primary');
    expect(text).toContain('minimum touch target');
  });

  it('returns the whole contract set when unscoped', async () => {
    const result = await call('get_constraints');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('touch-target-dense');
  });

  it('enumerates components on a bad scope', async () => {
    const result = await call('get_constraints', { component: 'Nope' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Components: ');
  });
});

describe('get_brand_guidance', () => {
  it('carries the voice rules and the kit pointer for a surface', async () => {
    const result = await call('get_brand_guidance', { surface: 'webapp' });
    expect(result.isError).toBeFalsy();
    const text = textOf(result);
    expect(text).toContain('Never the royal');
    expect(text).toContain('ui_kits/webapp/index.html');
    expect(text).toContain('Sidebar');
    expect(text).not.toContain('ui_kits/marketing');
  });

  it('offers every kit when no surface is named', async () => {
    const text = textOf(await call('get_brand_guidance'));
    expect(text).toContain('ui_kits/marketing');
    expect(text).toContain('ui_kits/docs');
  });

  it('enumerates the kits on an unknown surface', async () => {
    const result = await call('get_brand_guidance', { surface: 'intranet' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Kits: .*webapp/);
  });
});

describe('check_adherence', () => {
  it('flags raw design values and invented components', async () => {
    const result = await call('check_adherence', {
      code: 'export const Bad = () => <DataGrid style={{ color: "#ff0000" }} />;',
    });
    expect(result.isError).toBeFalsy();
    const text = textOf(result);
    expect(text).toContain('Raw hex color');
    expect(text).toContain('Not a component this design system exports');
  });

  it('flags a variant outside the extracted union', async () => {
    const text = textOf(
      await call('check_adherence', {
        code: 'export const Bad = () => <Button variant="danger" />;',
      }),
    );
    expect(text).toMatch(/variant must be one of/);
  });

  it('passes clean system usage', async () => {
    const text = textOf(
      await call('check_adherence', {
        code: 'export const Good = () => <Button variant="primary">Save</Button>;',
      }),
    );
    expect(text).toContain('No adherence findings');
  });

  it('reports an unparseable snippet with instructions, not a stack trace', async () => {
    const result = await call('check_adherence', { code: 'const = <<<' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('does not parse');
  });
});

describe('resources mirror the review surfaces', () => {
  it('lists brand voice and constraints', async () => {
    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri).sort()).toEqual([
      'miltinson://brand/voice',
      'miltinson://constraints',
    ]);
  });

  it('serves the voice rules for a human to @-mention', async () => {
    const { contents } = await client.readResource({ uri: 'miltinson://brand/voice' });
    expect(contents[0].text).toContain('Never the royal');
  });

  it('serves the full contract set as JSON', async () => {
    const { contents } = await client.readResource({ uri: 'miltinson://constraints' });
    expect(JSON.parse(contents[0].text).componentConstraints).toBeDefined();
  });
});
