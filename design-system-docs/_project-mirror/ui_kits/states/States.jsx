const { Button, EmptyState, Alert, Badge, SearchField, Separator, Spinner, Skeleton, RuleLink } = window.MiltinsonDesignSystem_e160cb;

const Frame = ({ label, children, tall }) => (
  <div style={{ display: 'grid', gap: 10 }}>
    <span className="t-eyebrow">{label}</span>
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', minHeight: tall ? 320 : 240, display: 'grid', placeItems: 'center', padding: 32 }}>{children}</div>
  </div>
);

const Big = ({ code, title, body, actions, note }) => (
  <div style={{ display: 'grid', gap: 14, maxWidth: 420, textAlign: 'center', justifyItems: 'center' }}>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--fg-4)' }}>{code}</span>
    <h2 className="t-h4" style={{ margin: 0 }}>{title}</h2>
    <p className="t-body-sm" style={{ margin: 0 }}>{body}</p>
    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>{actions}</div>
    {note ? <span className="t-caption">{note}</span> : null}
  </div>
);

const StatesKit = () => (
  <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px max(20px, 4vw) 64px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 28 }}>
    <div>
      <h1 className="t-h3" style={{ margin: '0 0 6px' }}>Error &amp; empty states</h1>
      <p className="t-body-sm" style={{ margin: 0 }}>Every one names what happened, what it means, and the single next move. No apologies without information, no dead ends.</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <Frame label="404 — not found">
        <Big code="404" title="That page has moved or never existed" body="The link might be old. Search usually finds it faster than guessing the URL." actions={<><Button>Go to the dashboard</Button><Button variant="secondary">Search</Button></>} />
      </Frame>
      <Frame label="500 — something broke">
        <Big code="500" title="Something broke on my side" body="Not your fault and nothing was lost. It's logged; try again in a minute." actions={<><Button>Try again</Button><Button variant="ghost">Email Eli</Button></>} note="Reference: 8f2c-41ab" />
      </Frame>
      <Frame label="403 — no permission">
        <Big code="403" title="You don't have access to this" body="Your role is Viewer. An Owner can change that in Team settings." actions={<><Button variant="secondary">Request access</Button><Button variant="ghost">Back</Button></>} />
      </Frame>
      <Frame label="Offline">
        <Big code="⚡" title="You're offline" body="Changes are saved on this device and will sync the moment you're back." actions={<Button variant="secondary">Retry now</Button>} note="Last synced 14 minutes ago" />
      </Frame>
      <Frame label="Empty — first run">
        <EmptyState title="No guides yet" description="Your first one takes about ten minutes. A draft is enough to start." action={<Button>Create a guide</Button>} />
      </Frame>
      <Frame label="Empty — filtered">
        <EmptyState title="No results with those filters" description="Try dropping ‘Free’ or widening the topic." action={<Button variant="secondary">Clear filters</Button>} />
      </Frame>
      <Frame label="Loading — skeleton">
        <div style={{ display: 'grid', gap: 10, width: '100%', maxWidth: 380 }}>
          <Skeleton width="45%" height={18} /><Skeleton width="100%" height={14} /><Skeleton width="80%" height={14} /><Skeleton width="30%" height={14} />
        </div>
      </Frame>
      <Frame label="Inline failure">
        <div style={{ display: 'grid', gap: 12, width: '100%', maxWidth: 420 }}>
          <Alert variant="danger" title="Card was declined">Your bank refused the charge. Nothing was taken — try another card or ask them why.</Alert>
          <Alert variant="warning" title="Working from a cached copy">The store is slow right now. Figures may be a few minutes old.</Alert>
        </div>
      </Frame>
    </div>
  </div>
);
Object.assign(window, { StatesKit });
