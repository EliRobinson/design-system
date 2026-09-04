// Tool display metadata is declared on the server and read on the client, and
// the only thing that crosses between them is JSON. So the round trip is the
// contract: attach a record to a tool definition, build the manifest, put it
// through JSON, and the label a panel shows has to survive all three steps.
//
// The fallback matters as much as the declared path. A tool with no display
// record is the normal state of a consumer's first tool set, and what it gets
// then is the difference between a panel that reads and one that shows
// `searchCatalogue` to a customer.

import { describe, expect, it } from 'vitest';

import {
  TOOL_DISPLAY,
  humanizeToolName,
  toolDisplay,
  toolDisplayManifest,
  toolDisplayName,
  withToolDisplay,
} from './tools.mjs';

/* Stands in for `tool()`'s result. The wrapper must not care what else is on
   it — a real tool definition carries a schema and an execute function, and
   this suite has no business depending on the SDK's shape for them. */
const searchTool = { description: 'Search the catalogue by keyword.', inputSchema: {} };

describe('withToolDisplay', () => {
  it('round-trips a display record through toolDisplay', () => {
    const labelled = withToolDisplay(searchTool, {
      label: 'Search the catalogue',
      description: 'Looks up products by keyword.',
      runningLabel: 'Searching the catalogue',
    });

    expect(toolDisplay(labelled)).toEqual({
      label: 'Search the catalogue',
      description: 'Looks up products by keyword.',
      runningLabel: 'Searching the catalogue',
    });
  });

  it('leaves the tool definition it was given untouched', () => {
    const labelled = withToolDisplay(searchTool, { label: 'Search the catalogue' });

    expect(toolDisplay(searchTool)).toBeNull();
    expect(labelled.description).toBe(searchTool.description);
    expect(labelled.inputSchema).toBe(searchTool.inputSchema);
  });

  /* A string key would collide with whatever the SDK decides `display` means
     next; a fresh symbol would stop matching across two copies of this module
     in one process. `Symbol.for` is the only option that survives both. */
  it('hangs the record off a registered symbol, not an enumerable key', () => {
    const labelled = withToolDisplay(searchTool, { label: 'Search the catalogue' });

    expect(TOOL_DISPLAY).toBe(Symbol.for('@elirobinson/ai-patterns:toolDisplay'));
    expect(Object.keys(labelled)).toEqual(Object.keys(searchTool));
  });

  it('rejects a record with no label, rather than shipping a blank panel row', () => {
    expect(() => withToolDisplay(searchTool, {})).toThrow('label');
    expect(() => withToolDisplay(searchTool, { label: '  ' })).toThrow('label');
  });

  it('drops a blank optional field rather than storing an empty string', () => {
    expect(() => withToolDisplay(searchTool, { label: 'Search', description: '' })).toThrow(
      'description',
    );
  });
});

describe('toolDisplayManifest', () => {
  const tools = {
    searchCatalogue: withToolDisplay(searchTool, {
      label: 'Search the catalogue',
      runningLabel: 'Searching the catalogue',
    }),
    fetchInvoice: { description: 'Fetch one invoice by id.' },
  };

  const manifest = toolDisplayManifest(tools);

  it('says where each label came from', () => {
    expect(manifest.searchCatalogue.source).toBe('declared');
    expect(manifest.fetchInvoice.source).toBe('fallback');
  });

  it('gives an unlabelled tool something readable instead of an identifier', () => {
    expect(manifest.fetchInvoice.label).toBe('Fetch Invoice');
  });

  /* The manifest is the only thing that crosses to the client. A symbol does
     not survive JSON, which is precisely why the manifest exists. */
  it('survives JSON, which is how it reaches the panel', () => {
    const delivered = JSON.parse(JSON.stringify(manifest));

    expect(delivered).toEqual(manifest);
    expect(toolDisplayName(delivered, 'searchCatalogue')).toBe('Search the catalogue');
    expect(toolDisplayName(delivered, 'fetchInvoice')).toBe('Fetch Invoice');
  });

  it('never hands a panel a raw identifier, even for a tool it has never heard of', () => {
    expect(toolDisplayName(manifest, 'refundOrder')).toBe('Refund Order');
    expect(toolDisplayName(undefined, 'refundOrder')).toBe('Refund Order');
  });
});

describe('humanizeToolName', () => {
  it.each([
    ['searchCatalogue', 'Search Catalogue'],
    ['search_catalogue', 'Search catalogue'],
    ['search-catalogue', 'Search catalogue'],
    ['search', 'Search'],
    ['fetchInvoicePDF', 'Fetch Invoice PDF'],
  ])('%s → %s', (name, expected) => {
    expect(humanizeToolName(name)).toBe(expected);
  });
});
