/* eslint-disable react/jsx-no-undef --
   Wordmark is defined by _shared/Kit.jsx. These kits are loaded as classic
   <script type="text/babel"> tags (see the index.html beside this file), in dependency
   order, sharing one global scope — so there is nothing to import and no module boundary
   to import it across. The directive is here because ds-resync writes this file into a
   consuming repo's .claude/skills/, a directory most projects lint. Scoped to the one
   rule so everything else about these samples is still linted. #119 */
/* global window, KIT_CONTENT -- a browser script: it reads the real components from
   window.DesignSystem (ds-bundle.js) and its strings from _shared/content.js, and
   publishes onto window for the files loaded after it. See index.html. */
/*
 * The page's header and footer. The footer sits on the inverse surface, so its text uses
 * the inverse tokens; the header is the page's own surface.
 */

const { Button, Separator } = window.DesignSystem;
const site = KIT_CONTENT.marketing;

const linkStyle = { color: 'inherit', textDecoration: 'none' };

function Header({ active = site.nav[0] }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
        minHeight: 64,
        padding: 'var(--space-2) var(--space-7)',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <a href="#" style={linkStyle}>
        <Wordmark />
      </a>
      <nav aria-label={site.navLabel} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        {site.nav.map((item) => (
          <a
            key={item}
            href="#"
            className="t-body-sm"
            aria-current={item === active ? 'page' : undefined}
            style={{
              ...linkStyle,
              color: item === active ? 'var(--fg)' : 'var(--fg-2)',
              fontWeight: item === active ? 'var(--fw-medium)' : undefined,
            }}
          >
            {item}
          </a>
        ))}
        <Button variant="primary" size="sm">
          {site.headerCta}
        </Button>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer style={{ background: 'var(--bg-inverse)', color: 'var(--fg-inverse)', padding: 'var(--space-10) var(--space-7) var(--space-7)' }}>
      <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Wordmark className="t-h4" />
            <span className="t-caption" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-inverse-2)' }}>
              {site.footer.tagline}
            </span>
          </div>
          <nav aria-label={site.footer.navLabel} style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            {site.footer.nav.map((item) => (
              <a key={item} href="#" className="t-body-sm" style={{ ...linkStyle, color: 'var(--fg-inverse)' }}>
                {item}
              </a>
            ))}
          </nav>
        </div>
        <Separator style={{ background: 'var(--border-inverse)' }} />
        <div className="t-caption" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', color: 'var(--fg-inverse-2)' }}>
          <span>{KIT_CONTENT.brand.domain}</span>
          <span>{KIT_CONTENT.brand.copyright}</span>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Header, Footer });
