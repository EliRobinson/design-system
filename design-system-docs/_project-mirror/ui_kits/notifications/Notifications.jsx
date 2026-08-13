const { Button, Avatar, Badge, Switch, Tabs, EmptyState, Separator, Popover, Toast, ToastViewport, SegmentedControl, Select } = window.MiltinsonDesignSystem_e160cb;

const FEED = [
  { who: 'Sam Doyle', what: 'published', obj: 'Practice Drills Vol. 1', when: '2 minutes ago', kind: 'publish', unread: true },
  { who: 'Stripe', what: 'settled a payout of', obj: '$1,240.00', when: '1 hour ago', kind: 'money', unread: true },
  { who: 'A customer', what: 'left a 5-star review on', obj: 'Session Plans for U10s', when: '3 hours ago', kind: 'review', unread: true },
  { who: 'Priya Nair', what: 'commented on', obj: 'Game-Day Frameworks', when: 'Yesterday', kind: 'comment' },
  { who: 'System', what: 'flagged a failed card on', obj: 'INV-0140', when: 'Tuesday', kind: 'alert' },
  { who: 'Sam Doyle', what: 'invited', obj: 'jo@example.com', when: 'Last week', kind: 'team' },
];
const DOT = { publish: 'var(--anchor-500)', money: 'var(--signal-500)', review: 'var(--signal-500)', comment: 'var(--fg-4)', alert: 'var(--status-danger)', team: 'var(--fg-4)' };

const Item = ({ n }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '10px 32px 1fr auto', gap: 12, alignItems: 'start', padding: '16px 0', borderTop: '1px solid var(--border)' }}>
    <span style={{ width: 8, height: 8, borderRadius: 999, background: n.unread ? DOT[n.kind] : 'transparent', marginTop: 12 }} />
    <Avatar name={n.who} size="sm" />
    <div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}><b style={{ fontWeight: 500 }}>{n.who}</b> {n.what} <a href="#">{n.obj}</a></p>
      <span className="t-caption">{n.when}</span>
    </div>
    <Button variant="ghost" size="sm">{n.unread ? 'Mark read' : 'Undo'}</Button>
  </div>
);

const Prefs = () => (
  <div style={{ display: 'grid', gap: 0 }}>
    {[['Sales and payouts', 'Every sale, plus payout settlement.'], ['Reviews', 'New ratings and written reviews.'], ['Team activity', 'Invites, role changes and comments.'], ['Product tips', 'Occasional, never more than monthly.']].map(([t, d]) => (
      <div key={t} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 24, alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--border)' }}>
        <div><div style={{ fontSize: 14, fontWeight: 500 }}>{t}</div><div className="t-caption">{d}</div></div>
        <Switch label="In app" defaultChecked />
        <Switch label="Email" defaultChecked={t !== 'Product tips'} />
      </div>
    ))}
    <div style={{ paddingTop: 20, borderTop: '1px solid var(--border)', marginTop: 8, maxWidth: 260 }}>
      <Select label="Quiet hours" options={[{ label: 'Off', value: 'off' }, { label: '20:00 – 08:00', value: 'night' }, { label: 'Weekends', value: 'weekend' }]} />
    </div>
  </div>
);

const NotificationsKit = () => {
  const [tab, setTab] = React.useState('all');
  const [items, setItems] = React.useState(FEED);
  const [toast, setToast] = React.useState(false);
  const unread = items.filter((i) => i.unread);
  return (
    <Page title="Notifications" description="What happened while you were away." actions={<Button variant="secondary" size="sm" onClick={() => { setItems(items.map((i) => ({ ...i, unread: false }))); setToast(true); }}>Mark all read</Button>}>
      <Tabs value={tab} onValueChange={setTab} tabs={[
        { label: 'All', value: 'all', content: <div>{items.map((n, i) => <Item key={i} n={n} />)}</div> },
        { label: 'Unread (' + unread.length + ')', value: 'unread', content: unread.length ? <div>{unread.map((n, i) => <Item key={i} n={n} />)}</div> : <EmptyState title="Nothing unread" description="You're caught up. New activity lands here." /> },
        { label: 'Settings', value: 'prefs', content: <Prefs /> },
      ]} />
      {toast ? <ToastViewport><Toast title="All caught up" description="6 notifications marked as read." onClose={() => setToast(false)} /></ToastViewport> : null}
    </Page>
  );
};
Object.assign(window, { NotificationsKit });
