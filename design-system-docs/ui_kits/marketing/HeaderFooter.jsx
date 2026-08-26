/* eslint-disable react/jsx-no-undef --
   Wordmark and Button are defined by _shared/Primitives.jsx. These kits are loaded as
   classic <script type="text/babel"> tags (see the index.html beside this
   file), in dependency order, sharing one global scope — so there is nothing
   to import and no module boundary to import it across.

   The directive is here because ds-resync writes this file into a consuming
   repo's .claude/skills/, a directory most projects lint, where the same code
   is indistinguishable from a module with missing imports. Scoped to the one
   rule so everything else about these samples is still linted. #119 */
/* global window -- a browser script: the kits publish their components onto
   window for the sibling kit files loaded after them. See index.html. */
const Header = ({ active = 'Home' }) => {
  const items = ['Home', 'Portfolio', 'Store', 'Services', 'About'];
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)',
        padding: '14px max(20px, 4vw)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <a href="#" style={{ textDecoration: 'none' }}>
        <Wordmark size={22} />
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        {items.map((item) => (
          <a
            key={item}
            href="#"
            style={{
              fontFamily: 'Geist, sans-serif',
              fontSize: 14,
              color: active === item ? 'var(--ink-1000)' : 'var(--fg-2)',
              fontWeight: active === item ? 500 : 400,
              textDecoration: 'none',
            }}
          >
            {item}
          </a>
        ))}
        <Button variant="primary" size="sm">
          Hire Me
        </Button>
      </nav>
    </header>
  );
};

const Footer = () => (
  <footer
    style={{
      background: 'var(--ink-1000)',
      color: 'var(--ink-0)',
      padding: '40px max(20px, 4vw) 32px',
      marginTop: 96,
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 32,
        paddingBottom: 28,
        borderBottom: '1px solid color-mix(in oklch, var(--ink-0) 18%, transparent)',
      }}
    >
      <div>
        <Wordmark size={26} dark />
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.08em',
            color: 'var(--fg-inverse-2)',
            marginTop: 12,
            textTransform: 'uppercase',
          }}
        >
          Builder · Consultant · Founder
        </div>
      </div>
      <nav style={{ display: 'flex', gap: 24 }}>
        {['Portfolio', 'Store', 'Services', 'About'].map((i) => (
          <a
            key={i}
            href="#"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-0)',
              textDecoration: 'none',
            }}
          >
            {i}
          </a>
        ))}
      </nav>
    </div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 18,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: 'var(--fg-inverse-3)',
        letterSpacing: '0.04em',
      }}
    >
      <span>miltinsons.com</span>
      <span>© 2026 Miltinson Technologies. All rights reserved.</span>
    </div>
  </footer>
);

Object.assign(window, { Header, Footer });
