import {
  ELEMENTS_TIERS,
  componentExports,
  elementsByTier,
  type ElementsTier,
} from '../../lib/ai-elements';

/* The roster of @elirobinson/ai-elements, rendered from the manifest the
   package generates on every build.

   Nothing in this file names a vendored component, and nothing in the pages
   around it does either. The tree is upstream's: `pnpm sync:elements --write`
   can add six components and remove one in a single commit, and a list written
   here would be wrong from that commit until somebody noticed. What is
   hand-written is the sentence introducing each tier, which is a fact about the
   directory rather than about its contents. */

const TIER_INTRO: Record<ElementsTier, string> = {
  components:
    'AI Elements proper — the assistant surfaces. Conversation and message logs, prompt inputs, tool and reasoning panels, artifact and canvas views.',
  ui: 'The shadcn/ui primitives the components above are built on, vendored with them because they are what those components import. Reach for them when you are extending an Element; for the rest of a page, the system’s own components are the ones with the keyboard contracts.',
  lib: 'The helpers the tree shares.',
};

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
            <p>{TIER_INTRO[tier]}</p>
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
