/* Display metadata for AI SDK tools.
 *
 * `tool()` has no display layer. It carries a description written for the *model* and a
 * schema, and the function name is whatever key the tool set was declared under — so a
 * tool panel rendering a stream has nothing human to lead with and shows `searchCatalogue`
 * to a reader. That is a gap in the SDK, not in the UI: the UI renders what the stream
 * contains, and the stream only ever carries the tool's name.
 *
 * So the label is declared beside the tool, on the server, and travels to the client as
 * data. Two halves:
 *
 *   - `withToolDisplay` attaches a record to a tool definition. It hangs off a symbol
 *     rather than a string key so it cannot collide with anything the SDK reads or
 *     validates, and `Symbol.for` rather than a fresh symbol so two copies of this module
 *     in one process still agree.
 *   - `toolDisplayManifest` turns a whole tool set into plain JSON. That is the thing a
 *     client bundle can hold: the symbol does not survive serialisation, and it does not
 *     need to.
 *
 * A tool with no declared display still gets a record, marked `source: 'fallback'`, whose
 * label is the humanised function name. A panel therefore never has to branch on absence,
 * and a reader never sees a camelCase identifier — but the manifest still says plainly
 * which labels are ours and which are guesses.
 */

/** Where a display record hangs off a tool definition. */
export const TOOL_DISPLAY = Symbol.for('@elirobinson/ai-patterns:toolDisplay');

function assertLabel(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`toolDisplay.${field} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizeDisplay(display) {
  if (display === null || typeof display !== 'object') {
    throw new TypeError('toolDisplay must be an object with at least a `label`.');
  }

  const record = { label: assertLabel(display.label, 'label') };

  /* Both optional, and both dropped rather than stored empty: a panel checking
     `record.description` must not have to also check for a blank string. */
  if (display.description !== undefined) {
    record.description = assertLabel(display.description, 'description');
  }
  if (display.runningLabel !== undefined) {
    record.runningLabel = assertLabel(display.runningLabel, 'runningLabel');
  }

  return record;
}

/**
 * `camelCase` / `snake_case` / `kebab-case` → a sentence-case phrase.
 *
 * The floor, not the goal. It is here so an undeclared tool degrades to something
 * readable instead of to an identifier, in the same spirit as the CLI naming what to
 * install rather than throwing.
 */
export function humanizeToolName(name) {
  const words = String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');

  if (words.length === 0) return String(name);

  /* Only the first word is recased. Lowercasing the rest would read better for
     `searchCatalogue` and would turn `fetchInvoicePDF` into "Fetch invoice pdf",
     so the acronym is left alone and the guess stays conservative. */
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/**
 * A tool definition plus the words a person should see for it.
 *
 * Returns a new object — the SDK's `tool()` result is not mutated, so the same definition
 * can be labelled differently in two tool sets.
 */
export function withToolDisplay(toolDefinition, display) {
  if (toolDefinition === null || typeof toolDefinition !== 'object') {
    throw new TypeError('withToolDisplay expects a tool definition object.');
  }

  return { ...toolDefinition, [TOOL_DISPLAY]: normalizeDisplay(display) };
}

/** The display record attached to a tool definition, or `null` when it has none. */
export function toolDisplay(toolDefinition) {
  if (toolDefinition === null || typeof toolDefinition !== 'object') return null;
  return toolDefinition[TOOL_DISPLAY] ?? null;
}

/**
 * A tool set → one plain-JSON record per tool, keyed by the name the stream carries.
 *
 * This is what crosses to the client. Serialisable by construction: no symbols, no
 * functions, no schema objects.
 */
export function toolDisplayManifest(tools) {
  if (tools === null || typeof tools !== 'object') {
    throw new TypeError('toolDisplayManifest expects a tool set object.');
  }

  return Object.fromEntries(
    Object.entries(tools).map(([name, definition]) => {
      const declared = toolDisplay(definition);
      return [
        name,
        declared === null
          ? { label: humanizeToolName(name), source: 'fallback' }
          : { ...declared, source: 'declared' },
      ];
    }),
  );
}

/** The label a panel shows for `name`, given a manifest. Never returns an identifier. */
export function toolDisplayName(manifest, name) {
  const record = manifest?.[name];
  if (record && typeof record.label === 'string' && record.label.trim() !== '') {
    return record.label;
  }
  return humanizeToolName(name);
}
