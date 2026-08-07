import { aaVerdict, contrastRatio } from '../../lib/color';
import { getToken } from '../../lib/tokens-css';

/* The pairings that actually occur in the system. Ratios and verdicts are
   computed from the live token values — if a token changes in the package,
   the verdicts change with it. */
const PAIRINGS: { fg: string; bg: string; usage: string }[] = [
  { fg: '--fg', bg: '--bg', usage: 'Body text on the page' },
  { fg: '--fg-2', bg: '--bg', usage: 'Secondary text' },
  { fg: '--fg-3', bg: '--bg', usage: 'Tertiary / meta text' },
  { fg: '--fg', bg: '--bg-subtle', usage: 'Text on panels and zebra rows' },
  { fg: '--accent-fg', bg: '--accent', usage: 'Label on an accent (amber) button' },
  { fg: '--anchor-fg', bg: '--anchor', usage: 'Label on a forest button' },
  { fg: '--fg-inverse', bg: '--bg-inverse', usage: 'Text on dark hero / footer' },
  { fg: '--accent', bg: '--bg-inverse', usage: 'Amber accents on ink (stats, links on dark)' },
  { fg: '--link-hover', bg: '--bg', usage: 'Link hover color' },
  { fg: '--status-success', bg: '--bg', usage: 'Success text' },
  { fg: '--status-warning', bg: '--bg', usage: 'Warning text' },
  { fg: '--status-danger', bg: '--bg', usage: 'Danger text' },
  { fg: '--status-info', bg: '--bg', usage: 'Info text' },
];

export function ContrastMatrix() {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Foreground</th>
            <th>Background</th>
            <th>Sample</th>
            <th>Ratio</th>
            <th>WCAG AA</th>
          </tr>
        </thead>
        <tbody>
          {PAIRINGS.map((pair) => {
            const fg = getToken(pair.fg)?.resolved;
            const bg = getToken(pair.bg)?.resolved;
            const ratio = fg && bg ? contrastRatio(fg, bg) : null;
            const verdict = ratio ? aaVerdict(ratio) : null;
            return (
              <tr key={`${pair.fg}-${pair.bg}`}>
                <td>
                  <code>{pair.fg}</code>
                  <div className="contrast-usage">{pair.usage}</div>
                </td>
                <td>
                  <code>{pair.bg}</code>
                </td>
                <td>
                  <span
                    className="contrast-sample"
                    style={{ color: `var(${pair.fg})`, background: `var(${pair.bg})` }}
                  >
                    Aa 16px
                  </span>
                </td>
                <td>{ratio ? `${ratio.toFixed(2)}:1` : '—'}</td>
                <td>
                  {verdict && (
                    <span
                      className={`contrast-verdict contrast-verdict--${
                        verdict === 'AA' ? 'pass' : verdict === 'AA large only' ? 'large' : 'fail'
                      }`}
                    >
                      {verdict}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
