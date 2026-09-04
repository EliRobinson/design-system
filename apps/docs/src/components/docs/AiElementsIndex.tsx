import { ELEMENTS_TIERS, componentExports, elementsByTier } from '../../lib/ai-elements';
import { ELEMENTS_TIER_INTRO } from '../../lib/editorial';

/* The roster of @elirobinson/ai-elements, rendered from the manifest the
   package generates on every build.

   Nothing in this file names a vendored component, and nothing in the pages
   around it does either. The tree is upstream's: `pnpm sync:elements --write`
   can add six components and remove one in a single commit, and a list written
   here would be wrong from that commit until somebody noticed. What is
   hand-written is the sentence introducing each namespace, which is a fact
   about the directory rather than about its contents — and it lives in
   editorial.ts because /components renders the same three. */

function EntryRow({ subpath, exports }: { subpath: string; exports: string[] }) {
  return (
    <tr>
      <td>
        <code>{subpath}</code>
      </td>
      <td>
        {exports.length > 0 ? (
          <details>
            <summary>{exports.length}</summary>
            <p className="elements-index__exports">
              {exports.map((name, index) => (
                <span key={name}>
                  {index > 0 ? ', ' : ''}
                  <code>{name}</code>
                </span>
              ))}
            </p>
          </details>
        ) : (
          <span>0</span>
        )}
      </td>
    </tr>
  );
}

export function AiElementsIndex() {
  return (
    <>
      {ELEMENTS_TIERS.map((tier) => {
        const entries = elementsByTier(tier);
        return (
          <section key={tier}>
            <h2 id={tier}>
              <a href={`#${tier}`}>
                {tier} ({entries.length})
              </a>
            </h2>
            <p>{ELEMENTS_TIER_INTRO[tier]}</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Import</th>
                    <th>Exports</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <EntryRow
                      key={entry.subpath}
                      subpath={entry.subpath}
                      exports={componentExports(entry)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
