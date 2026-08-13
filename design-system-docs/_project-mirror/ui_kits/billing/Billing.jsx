const { Button, Input, Select, Badge, Alert, Table, Card, CardContent, SegmentedControl, Separator, Chip, Stepper, RadioGroup, Checkbox, Kbd } = window.MiltinsonDesignSystem_e160cb;

const PLANS = [
  { name: 'Solo', price: { m: 0, y: 0 }, blurb: 'One product, community support.', features: ['1 product', 'Store page', 'Email receipts'] },
  { name: 'Studio', price: { m: 24, y: 240 }, blurb: 'Everything for a working indie.', features: ['Unlimited products', 'Custom domain', 'Assistant access', 'Priority replies'], featured: true },
  { name: 'Team', price: { m: 64, y: 640 }, blurb: 'Seats, roles and shared payouts.', features: ['Everything in Studio', '5 seats', 'Roles & audit log', 'Invoice billing'] },
];
const INVOICES = [
  { id: 'INV-0142', date: '1 Aug 2026', amount: '$24.00', status: 'Paid' },
  { id: 'INV-0139', date: '1 Jul 2026', amount: '$24.00', status: 'Paid' },
  { id: 'INV-0136', date: '1 Jun 2026', amount: '$24.00', status: 'Paid' },
  { id: 'INV-0133', date: '1 May 2026', amount: '$24.00', status: 'Refunded' },
];

const Plans = ({ cycle, setCycle, onChoose }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <SegmentedControl value={cycle} onValueChange={setCycle} options={[{ label: 'Monthly', value: 'm' }, { label: 'Yearly — 2 months free', value: 'y' }]} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
      {PLANS.map((p) => (
        <div key={p.name} style={{ border: '1px solid ' + (p.featured ? 'var(--ink-1000)' : 'var(--border)'), borderRadius: 'var(--radius-md)', background: 'var(--surface)', padding: 24, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="t-eyebrow">{p.name}</span>{p.featured ? <Badge variant="signal">Most picked</Badge> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: 'var(--font-mono)' }}>
            <span style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-0.02em' }}>${p.price[cycle]}</span>
            <span style={{ fontSize: 14, color: 'var(--fg-2)' }}>/{cycle === 'm' ? 'mo' : 'yr'}</span>
          </div>
          <p className="t-body-sm" style={{ margin: 0 }}>{p.blurb}</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {p.features.map((f) => <li key={f} style={{ fontSize: 14, display: 'flex', gap: 8 }}><span style={{ color: 'var(--anchor-500)' }}>✓</span>{f}</li>)}
          </ul>
          <Button variant={p.featured ? 'primary' : 'secondary'} onClick={() => onChoose(p)}>{p.price[cycle] === 0 ? 'Stay on Solo' : 'Choose ' + p.name}</Button>
        </div>
      ))}
    </div>
    <p className="t-caption" style={{ textAlign: 'center', margin: 0 }}>Prices in USD, excluding tax. Cancel any time — no contracts required.</p>
  </div>
);

const Checkout = ({ plan, cycle, onBack, onPaid }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 40, alignItems: 'start' }}>
    <div style={{ display: 'grid', gap: 20 }}>
      <Stepper steps={[{ label: 'Plan' }, { label: 'Payment' }, { label: 'Done' }]} activeStep={1} />
      <h2 className="t-h4" style={{ margin: 0 }}>Payment details</h2>
      <div style={{ display: 'grid', gap: 16, maxWidth: 460 }}>
        <Input label="Cardholder name" placeholder="Name on the card" autoComplete="cc-name" />
        <Input label="Card number" placeholder="4242 4242 4242 4242" autoComplete="cc-number" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input label="Expiry" placeholder="MM / YY" autoComplete="cc-exp" />
          <Input label="Security code" placeholder="123" autoComplete="cc-csc" />
        </div>
        <Select label="Country" options={[{ label: 'United Kingdom', value: 'gb' }, { label: 'United States', value: 'us' }]} />
        <Input label="Billing postcode" placeholder="LS1 1AA" autoComplete="postal-code" />
        <Checkbox label="Email me the invoice each month" defaultChecked />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button size="lg" onClick={onPaid}>Pay ${cycle === 'm' ? plan.price.m : plan.price.y}</Button>
        <Button variant="ghost" size="lg" onClick={onBack}>Back to plans</Button>
      </div>
    </div>
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', padding: 24, display: 'grid', gap: 14 }}>
      <span className="t-eyebrow">Order summary</span>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>{plan.name} · {cycle === 'm' ? 'monthly' : 'yearly'}</span><span style={{ fontFamily: 'var(--font-mono)' }}>${plan.price[cycle]}.00</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--fg-2)' }}><span>VAT (20%)</span><span style={{ fontFamily: 'var(--font-mono)' }}>${(plan.price[cycle] * 0.2).toFixed(2)}</span></div>
      <Separator />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 600 }}><span>Due today</span><span style={{ fontFamily: 'var(--font-mono)' }}>${(plan.price[cycle] * 1.2).toFixed(2)}</span></div>
      <p className="t-caption" style={{ margin: 0 }}>Renews {cycle === 'm' ? 'monthly' : 'yearly'} until cancelled. Cancel in Settings, any time.</p>
    </div>
  </div>
);

const Manage = ({ onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
    <Alert variant="warning" title="Card expires next month">The card ending 4242 expires 09/26. Update it before the next charge on 1 September.</Alert>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, display: 'grid', gap: 8 }}>
        <span className="t-eyebrow">Current plan</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 24, fontWeight: 600 }}>Studio</span><span className="t-caption">$24/mo · renews 1 Sep 2026</span></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}><Button size="sm" onClick={onChange}>Change plan</Button><Button variant="ghost" size="sm">Cancel</Button></div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, display: 'grid', gap: 8 }}>
        <span className="t-eyebrow">Payment method</span>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>•••• •••• •••• 4242</div>
        <div className="t-caption">Visa · expires 09/26</div>
        <div style={{ marginTop: 4 }}><Button variant="secondary" size="sm">Update card</Button></div>
      </div>
    </div>
    <div>
      <h2 className="t-h5" style={{ margin: '0 0 12px' }}>Invoices</h2>
      <Table data={INVOICES} columns={[
        { key: 'id', header: 'Invoice', render: (r) => <span style={{ fontFamily: 'var(--font-mono)' }}>{r.id}</span> },
        { key: 'date', header: 'Date' },
        { key: 'amount', header: 'Amount', render: (r) => <span style={{ fontFamily: 'var(--font-mono)' }}>{r.amount}</span> },
        { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'Paid' ? 'anchor' : 'default'}>{r.status}</Badge> },
        { key: 'pdf', header: '', render: () => <a href="../../patterns/invoice/invoice.html">PDF</a> },
      ]} />
    </div>
  </div>
);

const BillingKit = () => {
  const [view, setView] = React.useState('manage');
  const [cycle, setCycle] = React.useState('m');
  const [plan, setPlan] = React.useState(PLANS[1]);
  return (
    <Page title="Billing" description="Plan, payment method and every invoice.">
      {view === 'manage' ? <Manage onChange={() => setView('plans')} /> : null}
      {view === 'plans' ? <Plans cycle={cycle} setCycle={setCycle} onChoose={(p) => { setPlan(p); setView('checkout'); }} /> : null}
      {view === 'checkout' ? <Checkout plan={plan} cycle={cycle} onBack={() => setView('plans')} onPaid={() => setView('manage')} /> : null}
    </Page>
  );
};
Object.assign(window, { BillingKit });
