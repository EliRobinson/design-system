import { tokensByPrefix } from '../../lib/tokens-css';

/* Generic name/value/comment table for a token family, straight from
   tokens.css. */
export function TokenTable({ prefix }: { prefix: string }) {
  const tokens = tokensByPrefix(prefix);
  const hasComments = tokens.some((t) => t.comment);

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>Value</th>
            {hasComments && <th>Notes</th>}
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.name}>
              <td>
                <code>{token.name}</code>
              </td>
              <td>
                <code>{token.value}</code>
              </td>
              {hasComments && <td>{token.comment ?? '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
