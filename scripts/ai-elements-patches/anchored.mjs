/**
 * The find/replace engine the patch modules share (a11y.mjs, motion.mjs,
 * theme.mjs). Each module keeps its own `PATCHES` list and its own words for a
 * missed anchor; this file holds only the mechanism.
 *
 * A patch's `find` must appear exactly `count` times (default 1) in its file,
 * or this throws with the module's message. Silently not applying is the
 * failure no patch module tolerates: a bump that moves an anchor stops loudly
 * and names the patch, instead of dropping the fix and reporting a clean sync.
 */

/**
 * Apply every patch in `patches` that belongs to one upstream file.
 *
 * @param {Array<{ upstreamPath: string, find: string, replace: string, count?: number }>} patches
 * @param {string} source upstream bytes, after the earlier transform rules
 * @param {string} upstreamPath
 * @param {(patch: object, expected: number, found: number) => string} missMessage
 *   the module's error text for an anchor that does not appear `expected` times
 * @returns {{ source: string, fired: boolean }}
 */
export function applyAnchoredPatches(patches, source, upstreamPath, missMessage) {
  const own = patches.filter((patch) => patch.upstreamPath === upstreamPath);
  if (own.length === 0) return { source, fired: false };

  let current = source;
  for (const patch of own) {
    const expected = patch.count ?? 1;
    const found = current.split(patch.find).length - 1;
    if (found !== expected) {
      throw new Error(missMessage(patch, expected, found));
    }
    current = current.split(patch.find).join(patch.replace);
  }

  return { source: current, fired: true };
}
