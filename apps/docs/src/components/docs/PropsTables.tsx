import type { PropRecord } from '../../lib/manifest';
import { getComponent } from '../../lib/manifest';

function PropsTable({ props, inherits }: { props: PropRecord[]; inherits: string | null }) {
  return (
    <>
      {props.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Prop</th>
                <th>Type</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {props.map((prop) => (
                <tr key={prop.name}>
                  <td>
                    <code>{prop.name}</code>
                    {prop.required && <span className="props-required">required</span>}
                  </td>
                  <td>
                    <code>{prop.type}</code>
                  </td>
                  <td>{prop.defaultValue ? <code>{prop.defaultValue}</code> : '—'}</td>
                  <td>{prop.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No props of its own beyond the inherited HTML attributes.</p>
      )}
      {inherits && (
        <p className="props-inherits">
          Also accepts all <code>{inherits}</code> props.
        </p>
      )}
    </>
  );
}

/* Rendered straight from the generated manifest — the same data the search
   index and AI artifacts read, so this table cannot drift from the source. */
export function PropsTables({ slug }: { slug: string }) {
  const component = getComponent(slug);
  if (!component) {
    throw new Error(`Unknown component slug: ${slug}`);
  }

  return (
    <section className="props-tables">
      <PropsTable props={component.props} inherits={component.inherits} />
      {component.subComponents.map((sub) => (
        <div key={sub.name}>
          <h3 id={`props-${sub.name.toLowerCase()}`}>{sub.name}</h3>
          {sub.description && <p>{sub.description}</p>}
          <PropsTable props={sub.props} inherits={sub.inherits} />
        </div>
      ))}
      {component.extractionGaps.length > 0 && (
        <p className="props-gaps">Extraction notes: {component.extractionGaps.join('; ')}.</p>
      )}
    </section>
  );
}
