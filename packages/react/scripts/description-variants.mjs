// A component description must not restate its variants by hand.
//
// The manifest already publishes every variant union (`variants`) and the prop
// table built from it. A description that also lists them in prose is a second
// copy that goes stale the moment a value is added: #301 added
// `variant="destructive"` to Button and had to hand-edit the description.
//
// The check reads only the built manifest, so it covers both sources a
// description can come from: source JSDoc and component-descriptions.json.
// Three things count as a claim:
//
//   - one of the component's own variant values, anywhere in its description;
//   - a list of two or more variant values from any component ("sm/md/lg",
//     "success, warning, and info"), which is how a name that does not exist
//     shows up. A lone word from another component's union is left alone:
//     "primary" or "default" are ordinary English outside their own component;
//   - a count of a variant prop's values ("three sizes").

const NUMBER = '(?:one|two|three|four|five|six|seven|eight|nine|ten|\\d+)';

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const alternation = (words) => [...words].map(escape).join('|');

/** `size` -> `sizes`, `figureLayout` -> `layouts`: how prose counts a prop's values. */
const pluralOf = (prop) =>
  `${prop
    .split(/(?=[A-Z])/)
    .at(-1)
    .toLowerCase()}s`;

/** A sub-component's props carry their unions only as a type string. */
function variantsOfProps(props) {
  return props.flatMap(({ name, type }) => {
    const members = type.split(' | ');
    if (members.length < 2 || !members.every((member) => /^"[^"]*"$/.test(member))) return [];
    return [{ prop: name, values: members.map((member) => member.slice(1, -1)) }];
  });
}

/** Every component and sub-component as `{ name, description, variants }`. */
function describedRecords(components) {
  return components.flatMap((component) => [
    component,
    ...(component.subComponents ?? []).map((sub) => ({
      name: `${component.name}.${sub.name}`,
      description: sub.description,
      variants: variantsOfProps(sub.props),
    })),
  ]);
}

const stringValues = (variants) =>
  variants.flatMap(({ values }) =>
    // An empty literal would compile to `\b\b` and match every description.
    values.filter((value) => typeof value === 'string' && value !== ''),
  );

/** Matches in reading order, dropping any that sits inside an earlier one. */
function outermost(matches) {
  let end = -1;
  return matches
    .sort((a, b) => a.index - b.index || b[0].length - a[0].length)
    .filter((match) => {
      if (match.index < end) return false;
      end = match.index + match[0].length;
      return true;
    });
}

/**
 * @param {{ components: (Pick<import('./manifest-types').ComponentRecord,
 *   'name' | 'description' | 'variants'> &
 *   Partial<Pick<import('./manifest-types').ComponentRecord, 'subComponents'>>)[] }} manifest
 * @returns {{ component: string, claim: string }[]} each place a description
 *   names or counts variant values, in manifest order
 */
export function variantClaims(manifest) {
  const records = describedRecords(manifest.components);
  const allVariants = records.flatMap(({ variants }) => variants);

  const nouns = new Set(['variants', 'styles', ...allVariants.map(({ prop }) => pluralOf(prop))]);
  const counted = new RegExp(`\\b${NUMBER}\\s+(?:${alternation(nouns)})\\b`, 'gi');

  const word = `\\b(?:${alternation(new Set(stringValues(allVariants)))})\\b`;
  const listed = new RegExp(`${word}(?:\\s*(?:/|,|,?\\s+(?:and|or)\\s+)\\s*${word})+`, 'gi');

  return records.flatMap(({ name, description, variants }) => {
    const found = [...description.matchAll(counted), ...description.matchAll(listed)];

    const own = new Set(stringValues(variants));
    if (own.size > 0) {
      found.push(...description.matchAll(new RegExp(`\\b(?:${alternation(own)})\\b`, 'gi')));
    }

    return outermost(found).map((match) => ({ component: name, claim: match[0] }));
  });
}
