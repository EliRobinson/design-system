/* eslint-disable react/jsx-no-undef --
   Wordmark, Eyebrow and Button are defined by _shared/Primitives.jsx. These kits are loaded as
   classic <script type="text/babel"> tags (see the index.html beside this
   file), in dependency order, sharing one global scope — so there is nothing
   to import and no module boundary to import it across.

   The directive is here because ds-resync writes this file into a consuming
   repo's .claude/skills/, a directory most projects lint, where the same code
   is indistinguishable from a module with missing imports. Scoped to the one
   rule so everything else about these samples is still linted. See issue 119 for context. */
/* global window -- a browser script: the kits publish their components onto
   window for the sibling kit files loaded after them. See index.html. */
const Sidebar = ({ active = 'Dashboard' }) => {
  const items = [
    { name: 'Dashboard', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
    { name: 'Projects', icon: 'M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4' },
    {
      name: 'Clients',
      icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    },
    {
      name: 'Invoices',
      icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6M9 9h1',
    },
    { name: 'Analytics', icon: 'M3 3v18h18M7 14l4-4 4 4 6-6' },
    {
      name: 'Settings',
      icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
    },
  ];
  return (
    <aside
      style={{
        width: 240,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        padding: '20px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: '4px 8px 16px' }}>
        <Wordmark size={20} />
      </div>
      {items.map((it) => (
        <a
          key={it.name}
          href="#"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 10px',
            borderRadius: 4,
            fontFamily: 'Geist, sans-serif',
            fontSize: 14,
            textDecoration: 'none',
            color: active === it.name ? 'var(--ink-1000)' : 'var(--fg-2)',
            background: active === it.name ? 'var(--ink-0)' : 'transparent',
            border: active === it.name ? '1px solid var(--border)' : '1px solid transparent',
            fontWeight: active === it.name ? 500 : 400,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={it.icon} />
          </svg>
          {it.name}
        </a>
      ))}
      <div style={{ flex: 1 }}></div>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: 14,
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--ink-1000)',
              color: 'var(--ink-0)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'Geist, sans-serif',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            ER
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 500 }}>
              Eli Robinson
            </div>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: 'var(--fg-3)',
              }}
            >
              Pro plan
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

const TopBar = ({ title }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 32px',
      borderBottom: '1px solid var(--border)',
    }}
  >
    <div>
      <Eyebrow>Workspace · Miltinson</Eyebrow>
      <h1
        style={{
          fontFamily: 'Geist, sans-serif',
          fontWeight: 600,
          fontSize: 28,
          letterSpacing: '-0.02em',
          margin: '6px 0 0',
        }}
      >
        {title}
      </h1>
    </div>
    <div style={{ display: 'flex', gap: 10 }}>
      <Button variant="secondary" size="sm">
        Export
      </Button>
      <Button variant="primary" size="sm">
        New project
      </Button>
    </div>
  </div>
);

const StatCard = ({ label, value, delta, deltaPositive }) => (
  <div
    style={{
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: 20,
      background: 'var(--surface)',
    }}
  >
    <div
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--fg-3)',
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 500,
        fontSize: 36,
        letterSpacing: '-0.02em',
        marginTop: 12,
        color: 'var(--fg)',
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        marginTop: 6,
        color: deltaPositive ? 'var(--anchor-500)' : 'var(--status-danger)',
      }}
    >
      {deltaPositive ? '↑' : '↓'} {delta} this month
    </div>
  </div>
);

const ProjectsTable = () => {
  const rows = [
    { name: 'Kids Recipes', status: 'Live', tag: 'Web', mrr: '$0', updated: '2d ago' },
    { name: 'Maths', status: 'Live', tag: 'Web', mrr: '$0', updated: '1w ago' },
    {
      name: 'Coaching Guides Vol. 2',
      status: 'Draft',
      tag: 'Guide',
      mrr: '$840',
      updated: 'today',
    },
    {
      name: 'AI Workflow Audit (client)',
      status: 'In progress',
      tag: 'Service',
      mrr: '$1,200',
      updated: '3h ago',
    },
    {
      name: 'Tech Support · Smith Family',
      status: 'In progress',
      tag: 'Service',
      mrr: '$300',
      updated: 'today',
    },
  ];
  const statusColors = {
    Live: { bg: 'var(--anchor-100)', fg: 'var(--anchor-700)' },
    Draft: { bg: 'var(--ink-100)', fg: 'var(--fg-2)' },
    'In progress': { bg: 'var(--signal-100)', fg: 'var(--signal-800)' },
  };
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2.4fr 1fr 1fr 1fr 1fr',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
          background: 'var(--bg-subtle)',
        }}
      >
        <span>Project</span>
        <span>Status</span>
        <span>Type</span>
        <span>This month</span>
        <span>Updated</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '2.4fr 1fr 1fr 1fr 1fr',
            padding: '14px 20px',
            alignItems: 'center',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
            fontFamily: 'Geist, sans-serif',
            fontSize: 14,
          }}
        >
          <span style={{ fontWeight: 500 }}>{r.name}</span>
          <span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 999,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: statusColors[r.status].bg,
                color: statusColors[r.status].fg,
              }}
            >
              {r.status}
            </span>
          </span>
          <span style={{ color: 'var(--fg-2)' }}>{r.tag}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{r.mrr}</span>
          <span
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--fg-3)', fontSize: 12 }}
          >
            {r.updated}
          </span>
        </div>
      ))}
    </div>
  );
};

Object.assign(window, { Sidebar, TopBar, StatCard, ProjectsTable });
