// Charts are drawn from data, in ink with a single amber series. No chart library,
// no gradients, no 3D, no drop shadows — a chart is a table you can see.
const AXIS = 'var(--fg-3)';

const LineChart = ({ series, labels, width = 620, height = 220 }) => {
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const max = Math.max(...series.flatMap((s) => s.data)) * 1.1;
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const x = (i, n) => pad.l + (i / (n - 1)) * iw;
  const y = (v) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  return (
    <svg viewBox={'0 0 ' + width + ' ' + height} width="100%" role="img" aria-label="Revenue by month">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill={AXIS}>{t}</text>
        </g>
      ))}
      {series.map((s) => (
        <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={s.dashed ? '4 4' : undefined}
          points={s.data.map((v, i) => x(i, s.data.length) + ',' + y(v)).join(' ')} />
      ))}
      {series[0].data.map((v, i) => <circle key={i} cx={x(i, series[0].data.length)} cy={y(v)} r="3" fill="var(--ink-1000)" />)}
      {labels.map((l, i) => <text key={l} x={x(i, labels.length)} y={height - 8} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={AXIS}>{l}</text>)}
    </svg>
  );
};

const BarChart = ({ data, width = 300, height = 220 }) => {
  const pad = { l: 40, r: 8, t: 12, b: 26 };
  const max = Math.max(...data.map((d) => d.value)) * 1.1;
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const bw = iw / data.length;
  return (
    <svg viewBox={'0 0 ' + width + ' ' + height} width="100%" role="img" aria-label="Sales by product">
      <line x1={pad.l} x2={width - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="var(--border-strong)" />
      {data.map((d, i) => {
        const h = (d.value / max) * ih;
        return (
          <g key={d.label}>
            <rect x={pad.l + i * bw + bw * 0.18} y={pad.t + ih - h} width={bw * 0.64} height={h} fill={i === 0 ? 'var(--signal-500)' : 'var(--ink-1000)'} />
            <text x={pad.l + i * bw + bw / 2} y={height - 8} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={AXIS}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

const Sparkline = ({ data, width = 120, height = 32, color = 'var(--ink-1000)' }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => (i / (data.length - 1)) * width + ',' + (height - ((v - min) / (max - min || 1)) * height)).join(' ');
  return <svg viewBox={'0 0 ' + width + ' ' + height} width={width} height={height} aria-hidden="true"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" /></svg>;
};
Object.assign(window, { LineChart, BarChart, Sparkline });
