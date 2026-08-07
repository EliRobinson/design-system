import { contrastRatio, toHex } from '../../lib/color';
import { tokensByPrefix } from '../../lib/tokens-css';

/* Scale strip rendered from live tokens.css values. Contrast columns are
   computed, not asserted. */
export function ColorScale({ prefix }: { prefix: string }) {
  const seen = new Map<string, ReturnType<typeof tokensByPrefix>[number]>();
  for (const token of tokensByPrefix(prefix)) {
    seen.set(token.name, token); // last declaration wins, as in CSS
  }
  const tokens = [...seen.values()];

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th aria-label="Swatch" />
            <th>Value</th>
            <th>Hex</th>
            <th>On white</th>
            <th>On black</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => {
            const onWhite = contrastRatio(token.resolved, '#ffffff');
            const onBlack = contrastRatio(token.resolved, '#000000');
            return (
              <tr key={token.name}>
                <td>
                  <code>{token.name}</code>
                </td>
                <td>
                  <span className="color-swatch" style={{ background: `var(${token.name})` }} />
                </td>
                <td>
                  <code>{token.resolved}</code>
                </td>
                <td>
                  <code>{toHex(token.resolved) ?? '—'}</code>
                </td>
                <td>{onWhite ? `${onWhite.toFixed(2)}:1` : '—'}</td>
                <td>{onBlack ? `${onBlack.toFixed(2)}:1` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
