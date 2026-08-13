const { Button, Badge, SegmentedControl, Select, Table, Separator, DatePicker, Alert, Tabs } = window.MiltinsonDesignSystem_e160cb;

const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const THIS_YEAR = [1820, 2140, 1960, 2680, 3120, 3456];
const LAST_YEAR = [1210, 1380, 1290, 1740, 1880, 2050];
const PRODUCTS = [
  { label: 'U10s', value: 128 }, { label: 'Drills', value: 96 }, { label: 'Frames', value: 64 }, { label: 'GK', value: 22 },
];
const TABLE = [
  { product: 'Session Plans for U10s', sales: 128, revenue: '$1,536', refunds: '0', trend: [8, 10, 9, 14, 18, 22] },
  { product: 'Practice Drills Vol. 1', sales: 96, revenue: '$1,152', refunds: '1', trend: [12, 11, 9, 10, 8, 7] },
  { product: 'Game-Day Frameworks', sales: 64, revenue: '$768', refunds: '0', trend: [4, 5, 7, 9, 12, 14] },
  { product: 'Goalkeeping Basics', sales: 22, revenue: '$264', refunds: '2', trend: [1, 2, 2, 3, 5, 6] },
];

const Stat = ({ label, value, delta, up, spark }) => (
  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, background: 'var(--surface)', display: 'grid', gap: 8 }}>
    <span className="t-eyebrow">{label}</span>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>{value}</span>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span className="t-caption" style={{ color: up ? 'var(--anchor-500)' : 'var(--status-danger)' }}>{delta}</span>
      <Sparkline data={spark} color={up ? 'var(--anchor-500)' : 'var(--status-danger)'} />
    </div>
  </div>
);

const ReportingKit = () => {
  const [range, setRange] = React.useState('6m');
  const [compare, setCompare] = React.useState(true);
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px max(20px, 4vw) 64px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h3" style={{ margin: '0 0 6px' }}>Reporting</h1>
          <p className="t-body-sm" style={{ margin: 0 }}>Store performance, March to August 2026. Figures update hourly.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <SegmentedControl value={range} onValueChange={setRange} options={[{ label: '30d', value: '30d' }, { label: '6m', value: '6m' }, { label: '12m', value: '12m' }]} />
          <Button variant="secondary" size="sm">Export CSV</Button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Stat label="Revenue" value="$3,456" delta="+10.8% vs last month" up spark={THIS_YEAR} />
        <Stat label="Units" value="310" delta="+34 vs last month" up spark={[42, 48, 45, 58, 62, 71]} />
        <Stat label="Refund rate" value="0.9%" delta="+0.3pt vs last month" spark={[0.4, 0.5, 0.4, 0.6, 0.6, 0.9]} />
        <Stat label="Avg. order" value="$11.15" delta="−$0.40 vs last month" spark={[11.9, 11.7, 11.8, 11.5, 11.55, 11.15]} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="t-eyebrow">Revenue by month</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-2)' }}>
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} style={{ accentColor: 'var(--ink-1000)' }} />
              Compare to last year
            </label>
          </div>
          <LineChart labels={MONTHS} series={compare
            ? [{ name: '2026', data: THIS_YEAR, color: 'var(--ink-1000)' }, { name: '2025', data: LAST_YEAR, color: 'var(--fg-4)', dashed: true }]
            : [{ name: '2026', data: THIS_YEAR, color: 'var(--ink-1000)' }]} />
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span className="t-caption"><span style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--ink-1000)', verticalAlign: 'middle', marginRight: 6 }} />2026</span>
            {compare ? <span className="t-caption"><span style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--fg-4)', verticalAlign: 'middle', marginRight: 6 }} />2025</span> : null}
          </div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, background: 'var(--surface)' }}>
          <span className="t-eyebrow">Units by product</span>
          <div style={{ marginTop: 12 }}><BarChart data={PRODUCTS} /></div>
          <p className="t-caption" style={{ margin: '8px 0 0' }}>Amber marks your best seller.</p>
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, background: 'var(--surface)' }}>
        <span className="t-eyebrow">By product</span>
        <div style={{ marginTop: 12 }}>
          <Table data={TABLE} columns={[
            { key: 'product', header: 'Product' },
            { key: 'sales', header: 'Units', render: (r) => <span style={{ fontFamily: 'var(--font-mono)' }}>{r.sales}</span> },
            { key: 'revenue', header: 'Revenue', render: (r) => <span style={{ fontFamily: 'var(--font-mono)' }}>{r.revenue}</span> },
            { key: 'refunds', header: 'Refunds', render: (r) => <span style={{ fontFamily: 'var(--font-mono)' }}>{r.refunds}</span> },
            { key: 'trend', header: '6-month trend', render: (r) => <Sparkline data={r.trend} width={100} height={24} /> },
          ]} />
        </div>
      </div>
      <p className="t-caption" style={{ margin: 0 }}>Refunds are counted in the month the sale happened, not the month refunded — that's why last month can still move.</p>
    </div>
  );
};
Object.assign(window, { ReportingKit });
