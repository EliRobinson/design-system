import type { TokenEntry } from '../../lib/tokens-css';
import { cssTokens } from '../../lib/tokens-css';

const GROUPS: { title: string; match: (name: string) => boolean }[] = [
  { title: 'Backgrounds and surfaces', match: (n) => /^--(bg|surface)(-|$)/.test(n) },
  { title: 'Text', match: (n) => /^--fg(-|$)/.test(n) },
  { title: 'Borders', match: (n) => /^--border(-|$)/.test(n) },
  { title: 'Accent — Miltinson Amber', match: (n) => /^--accent(-|$)/.test(n) },
  { title: 'Anchor — Miltinson Forest', match: (n) => /^--anchor(-[a-z]+|$)/.test(n) },
  { title: 'Links and focus', match: (n) => /^--(link|focus-ring)(-|$)/.test(n) },
  { title: 'Status', match: (n) => /^--status-/.test(n) },
];

/* Every non-scale color token in tokens.css, grouped by prefix — derived
   from the file, so a token added to the package appears here on the next
   build. */
export function SemanticColorTable() {
  const latest = new Map<string, TokenEntry>();
  for (const token of cssTokens()) {
    if (/^--(ink|signal|anchor)-\d+$/.test(token.name)) {
      continue; // base scales have their own tables
    }
    latest.set(token.name, token);
  }
  const tokens = [...latest.values()];

  return (
    <>
      {GROUPS.map((group) => {
        const rows = tokens.filter((t) => group.match(t.name));
        if (rows.length === 0) {
          return null;
        }
        return (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th aria-label="Swatch" />
                    <th>References</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((token) => (
                    <tr key={token.name}>
                      <td>
                        <code>{token.name}</code>
                      </td>
                      <td>
                        <span
                          className="color-swatch"
                          style={{ background: `var(${token.name})` }}
                        />
                      </td>
                      <td>
                        <code>{token.value}</code>
                      </td>
                      <td>{token.comment ?? '—'}</td>
                    </tr>
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
