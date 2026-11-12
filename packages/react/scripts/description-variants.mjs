// A component description must not restate its variants by hand.
//
// The manifest already publishes every variant union (`variants`) and the prop
// table built from it. A description that also lists them in prose is a second
// copy that goes stale the moment a value is added: #301 added
// `variant="destructive"` to Button and had to hand-edit the description.
//
// The check reads only the built manifest, so it covers both sources a
// description can come from: source JSDoc and component-descriptions.json.

/** `three sizes`, `5 variants`: a count goes stale as surely as a list. */
const COUNTED =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:sizes|variants|tones|orientations|styles|kinds)\b/i;

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every string value any component gives a prop of this name. Checking a
 * Button description against all `variant` values, not just Button's, is what
 * catches a name that does not exist: `danger` is an Alert variant, so a
 * Button description saying "danger" is caught even though Button has none.
 */
function vocabularyByProp(components) {
  const byProp = new Map();
  for (const component of components) {
    for (const { prop, values } of component.variants) {
      const words = byProp.get(prop) ?? new Set();
      for (const value of values) if (typeof value === 'string') words.add(value);
      byProp.set(prop, words);
    }
  }
  return byProp;
}

/**
 * @param {{ components: { name: string, description: string,
 *   variants: { prop: string, values: (string | number)[] }[] }[] }} manifest
 * @returns {{ component: string, claim: string }[]} each place a description
 *   names a variant value or counts variants, in manifest order
 */
export function variantClaims(manifest) {
  const vocabulary = vocabularyByProp(manifest.components);
  const claims = [];

  for (const { name, description, variants } of manifest.components) {
    const counted = description.match(COUNTED);
    if (counted) claims.push({ component: name, claim: counted[0] });

    const words = new Set(variants.flatMap(({ prop }) => [...(vocabulary.get(prop) ?? [])]));
    for (const word of words) {
      if (new RegExp(`\\b${escape(word)}\\b`, 'i').test(description)) {
        claims.push({ component: name, claim: word });
      }
    }
  }

  return claims;
}
