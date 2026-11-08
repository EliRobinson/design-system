/* eslint-disable react/jsx-no-undef --
   Wordmark is defined by _shared/Kit.jsx. These kits are loaded as classic
   <script type="text/babel"> tags (see the index.html beside this file), in dependency
   order, sharing one global scope — so there is nothing to import and no module boundary
   to import it across. The directive is here because ds-resync writes this file into a
   consuming repo's .claude/skills/, a directory most projects lint. Scoped to the one
   rule so everything else about these samples is still linted. #119 */
/* global window, React, KIT_CONTENT -- a browser script: it reads the real components
   from window.DesignSystem (ds-bundle.js) and its strings from _shared/content.js, and
   publishes onto window for the files loaded after it. See index.html. */
/*
 * The app around the screens: a sidebar, a hash router, and one command palette that
 * ⌘K opens on every screen.
 */

const { Avatar, CommandPalette, NavigationMenu } = window.DesignSystem;
const app = KIT_CONTENT.webapp;

/* The route is the hash: `#/invoices` renders the invoices screen. */
function useRoute() {
  const read = () => window.location.hash.replace(/^#/, '').split('?')[0] || '/';
  const [route, setRoute] = React.useState(read);
  React.useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

const go = (href) => {
  window.location.hash = href.replace(/^#/, '');
};

/* The palette's results arrive after a short wait, so its loading row shows. */
function useCommandSearch() {
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (!query) return undefined;
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(timer);
  }, [query]);
  return { query, setQuery, loading };
}

function CommandMenu({ open, onOpenChange }) {
  const { query, setQuery, loading } = useCommandSearch();
  const commands = app.commands.map((command) => ({
    ...command,
    onSelect: () => {
      onOpenChange(false);
      if (command.href) go(command.href);
    },
  }));
  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      commands={commands}
      query={query}
      onQueryChange={setQuery}
      loading={loading}
    />
  );
}

function Sidebar({ route }) {
  return (
    <aside
      style={{
        flex: '1 1 220px',
        maxWidth: 260,
        boxSizing: 'border-box',
        padding: 'var(--space-6) var(--space-4)',
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      <a href="#/" style={{ color: 'var(--fg)', textDecoration: 'none', padding: '0 var(--space-3)' }}>
        <Wordmark />
      </a>
      <NavigationMenu aria-label={app.navLabel} items={app.nav} currentPath={`#${route}`} />
      <div style={{ marginTop: 'auto', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', padding: '0 var(--space-3)' }}>
        <Avatar alt={app.account.name} fallback={app.account.initials} size="sm" />
        <div>
          <div className="t-body-sm" style={{ fontWeight: 'var(--fw-medium)' }}>
            {app.account.name}
          </div>
          <div className="t-caption" style={{ color: 'var(--fg-3)' }}>
            {app.account.plan}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ⌘K or Ctrl+K opens the palette on any screen. */
function useCommandShortcut(setOpen) {
  React.useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
}

/* `bare` drops the sidebar, for a full-page flow such as onboarding. */
function AppShell({ route, bare, commandsOpen, onCommandsOpenChange, children }) {
  useCommandShortcut(onCommandsOpenChange);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', background: 'var(--bg)', color: 'var(--fg)' }}>
      {!bare && <Sidebar route={route} />}
      <main
        style={{
          flex: '999 1 560px',
          minWidth: 0,
          boxSizing: 'border-box',
          padding: 'var(--space-7) var(--space-9) var(--space-10)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
          position: 'relative',
        }}
      >
        {children}
      </main>
      <CommandMenu open={commandsOpen} onOpenChange={onCommandsOpenChange} />
    </div>
  );
}

/* The eyebrow, heading and actions every screen opens with. */
function PageHeader({ eyebrow, heading, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {eyebrow}
        <h1 className="t-h2" style={{ margin: 0 }}>
          {heading}
        </h1>
      </div>
      {children && <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>}
    </div>
  );
}

Object.assign(window, { AppShell, PageHeader, useRoute, go });
