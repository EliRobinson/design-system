import { aaVerdict, contrastRatio } from '../../lib/color';
import { getToken } from '../../lib/tokens-css';

/* The pairings that actually occur in the system. Ratios and verdicts are
   computed from the live token values — if a token changes in the package,
   the verdicts change with it.

   These are the default palette in its light theme, which is what `:root`
   declares and therefore what `getToken` resolves. Every other combination is
   measured in the package's own contrast.test.mjs, across all four; this table
   is the one a reader can see. */
const PAIRINGS: { fg: string; bg: string; usage: string }[] = [
  { fg: '--fg', bg: '--bg', usage: 'Body text on the page' },
  { fg: '--fg-2', bg: '--bg', usage: 'Secondary text' },
  { fg: '--fg-3', bg: '--bg', usage: 'Tertiary / meta text' },
  { fg: '--fg', bg: '--bg-subtle', usage: 'Text on panels and zebra rows' },
  { fg: '--accent-fg', bg: '--accent', usage: 'Label on the accent fill' },
  { fg: '--anchor-fg', bg: '--anchor', usage: 'Label on the anchor fill' },
  { fg: '--fg-inverse', bg: '--bg-inverse', usage: 'Text on dark hero / footer' },
  { fg: '--accent', bg: '--bg-inverse', usage: 'Accent fill on ink (stats, links on dark)' },
  /* --accent is a fill at 2.53:1 and cannot be a glyph. Anything brand-colored
     that a user has to read is --accent-ink, and showing the two a row apart is
     the point of the row. */
  { fg: '--accent-ink', bg: '--bg', usage: 'Brand color at readable weight (marks, glyphs)' },
  { fg: '--link-hover', bg: '--bg', usage: 'Link hover color' },
  /* Status text is --status-X-fg, never --status-X: the fills are cleared for
     3:1 as graphics and three of the four fall short of 4.5:1 as type — warning
     lands at 1.87:1. This table used to read --status-X here and reported a
     failing row for a token nobody was ever meant to set text in. */
  { fg: '--status-success-fg', bg: '--bg', usage: 'Success text' },
  { fg: '--status-warning-fg', bg: '--bg', usage: 'Warning text' },
  { fg: '--status-danger-fg', bg: '--bg', usage: 'Danger text' },
  { fg: '--status-info-fg', bg: '--bg', usage: 'Info text' },
  /* Text drawn ON each fill — the pairing a badge, a toast, or a filled alert
     actually makes. */
  { fg: '--status-success-on', bg: '--status-success', usage: 'Label on a success fill' },
  { fg: '--status-warning-on', bg: '--status-warning', usage: 'Label on a warning fill' },
  { fg: '--status-danger-on', bg: '--status-danger', usage: 'Label on a danger fill' },
  { fg: '--status-info-on', bg: '--status-info', usage: 'Label on an info fill' },
  /* The documented exception. Yellow cannot clear 3:1 on white and still read
     as yellow, so --status-warning sits at 1.87:1 and a warning fill or rule
     has to be edged with this token, which carries SC 1.4.11's 3:1 on its own.
     The verdict column below grades text, so read this row against 3:1: it is
     a non-text boundary, not a label. */
  {
    fg: '--status-warning-border',
    bg: '--bg',
    usage: 'The edge a warning fill must carry (non-text, 3:1)',
  },
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
