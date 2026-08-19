import type { TokenEntry } from '../../lib/tokens-css';
import { cssTokens } from '../../lib/tokens-css';

/* One row per group, matched by prefix against the live token set.

   --target-*, --safe-* and the rest of the geometry are deliberately absent.
   They are lengths, not colors: the swatch column would render a blank chip
   for `44px`, and `env(safe-area-inset-top, 0px)` has nothing to show in a
   table whose whole point is what a color looks like. A <TokenTable prefix>
   on the page that owns hit areas is where they belong. --n-h and --n-mult
   are out for the same reason — the hue and chroma a palette mixes its greys
   from are numbers, and the ink scale is what shows their effect. */
const GROUPS: { title: string; match: (name: string) => boolean }[] = [
  { title: 'Backgrounds and surfaces', match: (n) => /^--(bg|surface)(-|$)/.test(n) },
  { title: 'Text', match: (n) => /^--fg(-|$)/.test(n) },
  { title: 'Borders', match: (n) => /^--border(-|$)/.test(n) },
  { title: 'Accent — the palette’s signal color', match: (n) => /^--accent(-|$)/.test(n) },
  { title: 'Anchor — the palette’s second color', match: (n) => /^--anchor(-[a-z]+|$)/.test(n) },
  { title: 'Links and focus', match: (n) => /^--(link|focus-ring)(-|$)/.test(n) },
  { title: 'Status', match: (n) => /^--status-/.test(n) },
  { title: 'Charts — categorical, palette-independent', match: (n) => /^--chart-/.test(n) },
  { title: 'Overlays', match: (n) => /^--scrim(-|$)/.test(n) },
];

/* Every non-scale color token, grouped by prefix — derived from the
   stylesheets, so a token added to the package appears here on the next build.

   An empty group throws rather than rendering nothing. It used to return null,
   which is how the palette split could take --accent*, --anchor*, --link* and
   the whole status family out of this page at once and leave a build green:
   the color page rendered its greys and simply stopped mentioning the brand.
   A visible "no tokens matched" row would be the same failure one step later —
   it ships, and it needs someone to be looking. These pages are statically
   prerendered, so throwing fails `next build`, and site-structure.test.ts
   calls this directly so it fails `pnpm test` first. */
export function semanticColorGroups(): { title: string; rows: TokenEntry[] }[] {
  const latest = new Map<string, TokenEntry>();
  for (const token of cssTokens()) {
    if (/^--(ink|signal|anchor)-\d+$/.test(token.name)) {
      continue; // base scales have their own tables
    }
    latest.set(token.name, token);
  }
  const tokens = [...latest.values()];

  return GROUPS.map((group) => {
    const rows = tokens.filter((token) => group.match(token.name));
    if (rows.length === 0) {
      throw new Error(
        `SemanticColorTable group "${group.title}" matched no token. Either the ` +
          `family was renamed or it moved into a stylesheet cssTokens() does not ` +
          `read (see TOKEN_STYLESHEETS in @elirobinson/tokens) — fix the match or ` +
          `drop the group; do not let the section disappear.`,
      );
    }
    return { title: group.title, rows };
  });
}

export function SemanticColorTable() {
  return (
    <>
      {semanticColorGroups().map((group) => (
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
                {group.rows.map((token) => (
                  <tr key={token.name}>
                    <td>
                      <code>{token.name}</code>
                    </td>
                    <td>
                      <span className="color-swatch" style={{ background: `var(${token.name})` }} />
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
      ))}
    </>
  );
}
