const { Button, Input, Select, Switch, Avatar, Badge, Alert, Separator, Tabs, Table, Chip, Dialog, Toast, ToastViewport, RadioGroup } = window.MiltinsonDesignSystem_e160cb;
const Page = ({ title, description, children, actions }) => (
  <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px max(20px, 4vw) 64px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 28 }}>
      <div>
        <h1 className="t-h3" style={{ margin: '0 0 6px' }}>{title}</h1>
        {description ? <p className="t-body-sm" style={{ margin: 0 }}>{description}</p> : null}
      </div>
      {actions}
    </div>
    {children}
  </div>
);
const Row = ({ label, hint, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, padding: '20px 0', borderTop: '1px solid var(--border)', alignItems: 'start' }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
      {hint ? <div className="t-caption">{hint}</div> : null}
    </div>
    <div>{children}</div>
  </div>
);

const SESSIONS = [
  { device: 'MacBook Pro · Chrome', where: 'Leeds, UK', when: 'Now', current: true },
  { device: 'iPhone 15 · Safari', where: 'Leeds, UK', when: '2 hours ago' },
  { device: 'Windows · Edge', where: 'Manchester, UK', when: '3 days ago' },
];
const TEAM = [
  { name: 'Eli Robinson', email: 'eli@miltinsons.com', role: 'Owner' },
  { name: 'Sam Doyle', email: 'sam@example.com', role: 'Editor' },
  { name: 'Priya Nair', email: 'priya@example.com', role: 'Viewer' },
];

const Profile = () => (
  <div>
    <Row label="Photo" hint="PNG or JPG, at least 256px square.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar name="Eli Robinson" size="lg" />
        <Button variant="secondary" size="sm">Upload</Button>
        <Button variant="ghost" size="sm">Remove</Button>
      </div>
    </Row>
    <Row label="Display name"><Input label="" defaultValue="Eli Robinson" /></Row>
    <Row label="Email" hint="Used for receipts and sign-in."><Input label="" type="email" defaultValue="eli@miltinsons.com" /></Row>
    <Row label="Time zone"><Select label="" options={[{ label: 'Europe/London', value: 'gb' }, { label: 'America/New_York', value: 'us' }]} /></Row>
    <Row label="Language"><Select label="" options={[{ label: 'English (UK)', value: 'en-gb' }, { label: 'English (US)', value: 'en-us' }, { label: 'Español', value: 'es' }]} /></Row>
    <div style={{ display: 'flex', gap: 12, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
      <Button>Save changes</Button><Button variant="ghost">Discard</Button>
    </div>
  </div>
);

const Security = ({ onDelete }) => (
  <div>
    <Row label="Password" hint="Last changed 4 months ago."><Button variant="secondary" size="sm">Change password</Button></Row>
    <Row label="Two-factor" hint="Required for the owner account.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Switch label="Authenticator app" defaultChecked /><Badge variant="anchor">On</Badge></div>
    </Row>
    <Row label="Active sessions" hint="Sign out anything you don't recognise.">
      <div style={{ display: 'grid', gap: 8 }}>
        {SESSIONS.map((s) => (
          <div key={s.device} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
            <div>
              <div style={{ fontSize: 14 }}>{s.device} {s.current ? <Badge variant="signal">This device</Badge> : null}</div>
              <div className="t-caption">{s.where} · {s.when}</div>
            </div>
            {s.current ? null : <Button variant="ghost" size="sm">Sign out</Button>}
          </div>
        ))}
      </div>
    </Row>
    <div style={{ marginTop: 32, border: '1px solid var(--status-danger)', borderRadius: 'var(--radius-md)', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Delete this account</div>
        <div className="t-caption">Guides, customers and payout history go with it. There is no undo.</div>
      </div>
      <Button variant="secondary" onClick={onDelete}>Delete account</Button>
    </div>
  </div>
);

const Team = () => (
  <div style={{ display: 'grid', gap: 20 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
      <div style={{ flex: 1, maxWidth: 320 }}><Input label="Invite by email" placeholder="name@example.com" /></div>
      <div style={{ width: 160 }}><Select label="Role" options={[{ label: 'Editor', value: 'e' }, { label: 'Viewer', value: 'v' }]} /></div>
      <Button>Send invite</Button>
    </div>
    <Table columns={[{ key: 'name', header: 'Person', render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Avatar name={r.name} size="sm" /><span><span style={{ display: 'block' }}>{r.name}</span><span className="t-caption">{r.email}</span></span></span>
    ) }, { key: 'role', header: 'Role', render: (r) => <Badge variant={r.role === 'Owner' ? 'solid' : 'default'}>{r.role}</Badge> }]} data={TEAM} />
  </div>
);

const Notifications = () => (
  <div>
    <Row label="Email" hint="Sent to eli@miltinsons.com.">
      <div style={{ display: 'grid', gap: 2 }}>
        <Switch label="Every sale" defaultChecked /><Switch label="Weekly summary" defaultChecked /><Switch label="Product tips" />
      </div>
    </Row>
    <Row label="Digest frequency"><RadioGroup name="digest" value="weekly" options={[{ label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Never', value: 'never' }]} /></Row>
  </div>
);

const SettingsKit = () => {
  const [tab, setTab] = React.useState('profile');
  const [dialog, setDialog] = React.useState(false);
  const [toast, setToast] = React.useState(false);
  return (
    <Page title="Settings" description="Your account, security and who else can get in.">
      <Tabs value={tab} onValueChange={setTab} tabs={[
        { label: 'Profile', value: 'profile', content: <Profile /> },
        { label: 'Security', value: 'security', content: <Security onDelete={() => setDialog(true)} /> },
        { label: 'Team', value: 'team', content: <Team /> },
        { label: 'Notifications', value: 'notify', content: <Notifications /> },
      ]} />
      <Dialog open={dialog} onOpenChange={setDialog} title="Delete this account?" description="Type nothing, click nothing else — this removes every guide, customer and payout record. There is no undo." footer={<><Button variant="secondary" onClick={() => setDialog(false)}>Keep my account</Button><Button onClick={() => { setDialog(false); setToast(true); }}>Delete permanently</Button></>} />
      {toast ? <ToastViewport><Toast variant="danger" title="Account scheduled for deletion" description="You have 30 days to change your mind." onClose={() => setToast(false)} /></ToastViewport> : null}
    </Page>
  );
};
Object.assign(window, { SettingsKit, Page, Row });
