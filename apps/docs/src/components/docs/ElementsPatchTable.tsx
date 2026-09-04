import contracts from '@elirobinson/ai-patterns/contracts';

/* What this system changed about a vendored component, and why — read from
   contracts.json's `vendoredElementTargets` rather than retyped.

   Upstream's documentation at elements.ai-sdk.dev describes the unskinned,
   unpatched component. Ours is that component plus a known transform, and the
   transform is the interesting part: each entry names one control, the geometry
   a browser measured for it, which of the two touch-target floors it was held
   to, and why it is that one and not the other.

   Keyed by the patch id, which is also the id in
   `scripts/ai-elements-patches/a11y.mjs` — so a patch that is renamed or
   removed drops out of the page by itself.

   Two keys in that object are not controls and are skipped: `policy`, which is
   the section's preamble, and `verifiedBy`, which is a nested object naming the
   spec that measured each entry. The filter is on the value's type rather than
   on a list of names, so a third non-control key does not render as an empty
   row.

   What this table does NOT cover: the reduced-motion patches, which live in
   `scripts/ai-elements-patches/motion.mjs` and are deliberately absent from
   `vendoredElementTargets`. Every entry there is a control's geometry measured
   against one of two published touch-target floors, and a scroll behaviour is
   neither — see that module's header. A page with a motion patch to describe
   says so in its own prose. */

const TARGETS = contracts.vendoredElementTargets as Record<string, unknown>;

/** Every entry that is a control, in the order contracts.json lists them. */
function controls(): [string, string][] {
  return Object.entries(TARGETS).filter(
    (entry): entry is [string, string] => entry[0] !== 'policy' && typeof entry[1] === 'string',
  );
}

export type ElementsPatchTableProps = {
  /** Manifest names. An entry naming `<name>.tsx` is this family's. */
  components: readonly string[];
  /* Patch ids on a file the family does not own but every control in it goes
     through — `button-floor` is the whole reason a vendored Approve button
     clears 44x44, and it is recorded against `ui/button.tsx`. Named explicitly
     rather than inferred, so the page states which shared floor it is leaning
     on, and unknown ids throw at build time rather than vanishing. */
  also?: readonly string[];
};

export function ElementsPatchTable({ components, also = [] }: ElementsPatchTableProps) {
  const rows = controls().filter(
    ([id, text]) => also.includes(id) || components.some((name) => text.includes(`${name}.tsx`)),
  );

  const missing = also.filter((id) => !rows.some(([rowId]) => rowId === id));
  if (missing.length > 0) {
    throw new Error(
      `ElementsPatchTable: no entry in vendoredElementTargets for ${missing.join(', ')}. ` +
        'The patch was renamed or removed — update the page rather than the contract.',
    );
  }

  if (rows.length === 0) {
    return (
      <p>
        No entry in <code>vendoredElementTargets</code> names these components&rsquo; files: the
        transform layer changes nothing about their own markup.
      </p>
    );
  }

  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Patch</th>
              <th>What changed, and why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, text]) => (
              <tr key={id}>
                <td>
                  <code>{id}</code>
                </td>
                <td>{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="patch-table__note">
        Read from <code>vendoredElementTargets</code> in{' '}
        <code>@elirobinson/ai-patterns/contracts</code>, which the browser audit writes.
      </p>
    </>
  );
}
