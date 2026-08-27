/* global window, KIT_CONTENT -- a browser script: the kits publish their components
   onto window for the sibling kit files loaded after them, and read their strings from
   _shared/content.js, which is loaded first. See index.html. */
// Shared UI primitives for the UI kits.
// Loaded as a Babel script. Exposes components on window.

const Wordmark = ({ size = 22, dark = false }) => (
  <span
    style={{
      fontFamily: 'Geist, system-ui, sans-serif',
      fontWeight: 600,
      fontSize: size,
      letterSpacing: '-0.025em',
      lineHeight: 1,
      color: dark ? 'var(--ink-0)' : 'var(--ink-1000)',
      display: 'inline-flex',
      alignItems: 'baseline',
    }}
  >
    {KIT_CONTENT.brand.wordmark}
    <span style={{ color: 'var(--accent)' }}>.</span>
  </span>
);

const Eyebrow = ({ children, color }) => (
  <span
    style={{
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: color || 'var(--fg-2)',
    }}
  >
    {children}
  </span>
);

const Tag = ({ children, variant = 'default' }) => {
  const styles = {
    default: { background: 'var(--ink-100)', color: 'var(--fg-2)' },
    signal: { background: 'var(--signal-100)', color: 'var(--signal-800)' },
    anchor: { background: 'var(--anchor-100)', color: 'var(--anchor-700)' },
    solid: { background: 'var(--ink-1000)', color: 'var(--ink-0)' },
    outline: {
      background: 'transparent',
      color: 'var(--fg-2)',
      border: '1px solid var(--border-strong)',
    },
  };
  return (
    <span
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '4px 10px',
        borderRadius: 999,
        display: 'inline-block',
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
};

const Button = ({ children, variant = 'primary', size = 'md', onClick, icon }) => {
  const sizes = {
    sm: { fontSize: 13, padding: '8px 12px' },
    md: { fontSize: 14, padding: '12px 18px' },
    lg: { fontSize: 16, padding: '14px 22px' },
  };
  const variants = {
    primary: { background: 'var(--ink-1000)', color: 'var(--ink-0)' },
    accent: { background: 'var(--signal-500)', color: 'var(--ink-1000)' },
    secondary: {
      background: 'transparent',
      color: 'var(--fg)',
      border: '1px solid var(--border-strong)',
    },
    ghost: { background: 'transparent', color: 'var(--fg)' },
  };
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'Geist, sans-serif',
        fontWeight: 500,
        lineHeight: 1,
        borderRadius: 4,
        border: '1px solid transparent',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 140ms cubic-bezier(0.22,1,0.36,1)',
        ...sizes[size],
        ...variants[variant],
      }}
    >
      {children}
      {icon && <Arrow />}
    </button>
  );
};

const Arrow = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

const RuleLink = ({ children, href = '#' }) => (
  <a
    href={href}
    style={{
      fontFamily: 'Geist, sans-serif',
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--fg)',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      borderBottom: '1px solid var(--ink-1000)',
      paddingBottom: 2,
    }}
  >
    {children} <Arrow />
  </a>
);

Object.assign(window, { Wordmark, Eyebrow, Tag, Button, Arrow, RuleLink });
