/* The shape of a voice pack.
 *
 * A pack is the prose equivalent of a palette: a named set of values a consumer may swap
 * wholesale. The system ships this schema and one pack; a consumer's own pack fills the
 * same slots. See docs/agents/brand-boundary.md.
 *
 * Every section is marked `product` today. `system` exists in the schema from day one
 * because #159 open question 1 — whether the avoid list is a blocklist any brand would
 * accept — is deliberately unsettled, and promoting one section later should be a
 * one-field change rather than a format change.
 */

/** @type {Array<{key: string, level: 'system'|'product', required: boolean}>} */
export const VOICE_SECTIONS = [
  { key: 'person', level: 'product', required: true },
  { key: 'tone', level: 'product', required: true },
  { key: 'casing', level: 'product', required: true },
  { key: 'words', level: 'product', required: true },
  { key: 'emoji', level: 'product', required: true },
  { key: 'samples', level: 'product', required: true },
  { key: 'taglines', level: 'product', required: true },
];

/* Field paths that must be present, and must not be empty when they are arrays. An
   empty enumeration passes a naive presence check and is almost always a bad merge,
   which is the failure this schema exists to make loud. */
const REQUIRED_PATHS = [
  'id',
  'label',
  'person.guidance',
  'person.anchors.asPerson',
  'person.anchors.asCompany',
  'tone',
  'casing',
  'words.use',
  'words.avoid',
  'emoji.guidance',
  'samples',
  'taglines',
];

function at(pack, path) {
  return path.split('.').reduce((value, key) => (value == null ? value : value[key]), pack);
}

/**
 * @param {object} pack
 * @returns {object} the same pack, for chaining
 * @throws {Error} naming the first failing field path
 */
export function validatePack(pack) {
  if (pack == null || typeof pack !== 'object') {
    throw new Error('voice pack: expected an object');
  }

  for (const path of REQUIRED_PATHS) {
    const value = at(pack, path);

    if (value === undefined || value === null || value === '') {
      throw new Error(`voice pack "${pack.id ?? '(no id)'}": missing ${path}`);
    }

    if (Array.isArray(value) && value.length === 0) {
      throw new Error(
        `voice pack "${pack.id}": ${path} is empty. An empty enumeration is almost ` +
          'always a bad merge — remove the field or give it values.',
      );
    }
  }

  return pack;
}
