/* Assertions layer: a real Client driven against createMcpHandler(createServer)
 * in process — no port, no spawn, no mock. Every test asserts on the resolved
 * value, never through try/catch: a tool failure is a *successful* JSON-RPC
 * result carrying `isError: true`, and a try/catch-based test would pass
 * forever regardless of behaviour. Packaging concerns (shebang, exec bit,
 * stray stdout) live in stdio.smoke.test.mjs — this harness cannot see them. */

import {
  COMBINATIONS,
  DEFAULT_PLATFORM,
  DIALS,
  PALETTES,
  PLATFORMS,
  THEMES,
  defaultCombinationId,
} from '@elirobinson/tokens/dials';
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
/* Everything after `search_tokens`'s header paragraph. The header legitimately
   names the default combination, so an assertion that a token's own rendering
   carries no combination label has to look past it. */
const bodyOf = (result) => textOf(result).split('\n\n').slice(1).join('\n\n');

describe('the tool surface', () => {
  it('offers exactly the six spec tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'check_adherence',
      'get_brand_guidance',
      'get_component',
      'get_constraints',
      'get_dials',
      'search_tokens',
    ]);
  });
});

/* The dial surfaces are asserted against the roster imported from
   @elirobinson/tokens/dials, never against a literal list. That is the whole
   point of these tests: add a third palette upstream and every expectation
   below widens by itself, so a server that went on answering for two would
   fail here instead of quietly answering for two thirds of the system. */
describe('get_dials', () => {
  it('reports every dial with its attribute, values and default', async () => {
    const result = await call('get_dials');
    expect(result.isError).toBeFalsy();
    const text = textOf(result);
    for (const dial of DIALS) {
      expect(text).toContain(dial.attribute);
      expect(text).toContain(`${dial.default} (default)`);
      for (const value of dial.values) {
        expect(text).toContain(value);
      }
    }
  });

  it('reports every combination, and the attributes that select it', async () => {
    const text = textOf(await call('get_dials'));
    for (const combination of COMBINATIONS) {
      expect(text).toContain(combination.id);
    }
    for (const palette of PALETTES) {
      expect(text).toContain(palette);
    }
    for (const theme of THEMES) {
      expect(text).toContain(theme);
    }
    /* Every non-default palette and theme has to appear as a settable
       attribute, or the table lists combinations a reader cannot reach. */
    for (const combination of COMBINATIONS) {
      if (combination.id === defaultCombinationId()) continue;
      expect(text).toMatch(new RegExp(`\\| ${combination.id} \\| data-\\w`));
    }
  });

  it('names the default combination as the default, with no attributes', async () => {
    const text = textOf(await call('get_dials'));
    expect(text).toContain(`${defaultCombinationId()} (default)`);
    expect(text).toMatch(new RegExp(`\\| ${defaultCombinationId()} \\(default\\) \\| \\(none`));
  });

  it('keeps the platform orthogonal — an override, never part of a combination id', async () => {
    const text = textOf(await call('get_dials'));
    for (const platform of PLATFORMS) {
      expect(text).toContain(platform);
      for (const combination of COMBINATIONS) {
        expect(text).not.toContain(`${combination.id}/${platform}`);
      }
    }
    /* The non-default platforms are the ones with a selector and a list of
       what they re-point. `data-platform='mobile'` is that selector. */
    for (const platform of PLATFORMS.filter((name) => name !== DEFAULT_PLATFORM)) {
      expect(text).toContain(`[data-platform='${platform}']`);
    }
    expect(text).toMatch(/Re-points \d+ token\(s\)/);
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

  /* A family whose name carries no suffix — `--scrim`, `--target` — used to be
     unreachable in both directions at once: the prefix regex required a
     trailing hyphen so the family never appeared in the `Prefixes:` list, and
     the caller's prefix was normalised to `--scrim-`, which matches nothing.
     A model asking for it got a failure whose recovery list omitted the very
     thing it had asked for. */
  it('finds a family that is a token in its own right', async () => {
    for (const [prefix, name] of [
      ['scrim', '--scrim'],
      ['--scrim', '--scrim'],
      ['target', '--target'],
    ]) {
      const result = await call('search_tokens', { prefix, limit: 50 });
      expect(result.isError).toBeFalsy();
      expect(bodyOf(result)).toMatch(new RegExp(`^${name}:`, 'm'));
    }
  });

  it('still returns the suffixed members of a bare family', async () => {
    const body = bodyOf(await call('search_tokens', { prefix: 'target', limit: 50 }));
    expect(body).toMatch(/^--target-min:/m);
    expect(body).toMatch(/^--target-lg:/m);
  });

  it('lists the bare families among the prefixes it offers on a miss', async () => {
    const text = textOf(await call('search_tokens', { query: 'brand-primary' }));
    expect(text).toContain('--scrim');
    expect(text).toContain('--target');
  });
});

describe('search_tokens carries the combination', () => {
  it('labels a varying token once per combination, in COMBINATIONS order', async () => {
    const body = bodyOf(await call('search_tokens', { prefix: 'scrim', limit: 50 }));
    expect(body).toContain('varies by combination');
    /* Exactly one labelled value per combination — no more (a duplicated or
       platform-folded axis) and no fewer (a palette the surface did not pick
       up). This is the assertion that fails the day a third palette lands and
       this server has not widened. */
    const labelled = body.split('\n').filter((line) => /^ {4}\S+\/\S+: /.test(line));
    expect(labelled).toHaveLength(COMBINATIONS.length);
    expect(labelled.map((line) => line.trim().split(':')[0])).toEqual(
      COMBINATIONS.map((combination) => combination.id),
    );
  });

  it('prints one unlabelled value for a token that does not vary', async () => {
    const body = bodyOf(await call('search_tokens', { prefix: 'target', limit: 50 }));
    expect(body).not.toContain('varies by combination');
    for (const combination of COMBINATIONS) {
      expect(body).not.toContain(combination.id);
    }
  });

  it('appends a platform override on top of the combinations, with its selector', async () => {
    const body = bodyOf(await call('search_tokens', { query: 'radius-sm', limit: 50 }));
    for (const platform of PLATFORMS.filter((name) => name !== DEFAULT_PLATFORM)) {
      expect(body).toContain(`${platform} [data-platform='${platform}']:`);
      /* Orthogonal, not folded: no combination id ever carries a platform. */
      for (const combination of COMBINATIONS) {
        expect(body).not.toContain(`${combination.id}/${platform}`);
      }
    }
  });

  it('heads every answer with the default combination and a pointer to get_dials', async () => {
    const text = textOf(await call('search_tokens', { prefix: 'scrim' }));
    expect(text).toContain(defaultCombinationId());
    expect(text).toContain('get_dials');
  });

  it('keeps the resolved value and the comment it always carried', async () => {
    const body = bodyOf(await call('search_tokens', { query: 'status-success-on', limit: 50 }));
    expect(body).toContain('(resolves to ');
    expect(body).toContain('on the fill');
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
    expect(text).toContain('Miltinson Technologies');
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
    expect(contents[0].text).toContain('Miltinson Technologies');
  });

  it('serves the full contract set as JSON', async () => {
    const { contents } = await client.readResource({ uri: 'miltinson://constraints' });
    expect(JSON.parse(contents[0].text).componentConstraints).toBeDefined();
  });
});
