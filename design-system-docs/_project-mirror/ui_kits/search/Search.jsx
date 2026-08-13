const { SearchField, Chip, Badge, Button, Select, Pagination, Checkbox, EmptyState, Separator, Skeleton, SegmentedControl, Rating } = window.MiltinsonDesignSystem_e160cb;

const RESULTS = [
  { title: 'Session Plans for U10s', type: 'Guide', tags: ['Coaching', 'Football'], price: '$12', rating: 5, blurb: 'Twelve ready-to-run sessions with warm-ups, drills and a cool-down.' },
  { title: 'Practice Drills Vol. 1', type: 'Guide', tags: ['Coaching'], price: '$9', rating: 4, blurb: 'Forty drills sorted by what they fix, not by what they look like.' },
  { title: 'Pressing 101', type: 'Article', tags: ['Coaching', 'Free'], price: 'Free', rating: 5, blurb: 'A press is a decision, not a sprint — the three triggers worth chasing.' },
  { title: 'Kids Recipes', type: 'App', tags: ['Food', 'Family'], price: 'Free', rating: 4, blurb: 'Simple, fun recipes designed for kids to cook themselves.' },
  { title: 'Game-Day Frameworks', type: 'Guide', tags: ['Coaching'], price: '$12', rating: 4, blurb: 'What to say at 0-0, 2-0 up, and 2-0 down.' },
];

const Facet = ({ title, options }) => (
  <div style={{ display: 'grid', gap: 6 }}>
    <span className="t-eyebrow">{title}</span>
    {options.map((o) => <Checkbox key={o} label={o} />)}
  </div>
);

const SearchKit = () => {
  const [q, setQ] = React.useState('coaching');
  const [sort, setSort] = React.useState('relevance');
  const [view, setView] = React.useState('list');
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState(['Guide', 'Coaching']);
  const results = q.trim() === '' ? [] : RESULTS;
  const run = (v) => { setQ(v); setLoading(true); setTimeout(() => setLoading(false), 350); };
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px max(20px, 4vw) 64px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, marginBottom: 24 }}>
        <SearchField value={q} onValueChange={run} placeholder="Search guides, apps and articles" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {filters.map((f) => <Chip key={f} onRemove={() => setFilters(filters.filter((x) => x !== f))}>{f}</Chip>)}
          {filters.length ? <Button variant="ghost" size="sm" onClick={() => setFilters([])}>Clear all</Button> : null}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 190 }}><Select label="" value={sort} onChange={(e) => setSort(e.target.value)} options={[{ label: 'Sort: relevance', value: 'relevance' }, { label: 'Sort: newest', value: 'new' }, { label: 'Sort: price', value: 'price' }]} /></div>
            <SegmentedControl value={view} onValueChange={setView} options={[{ label: 'List', value: 'list' }, { label: 'Grid', value: 'grid' }]} />
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 32, alignItems: 'start' }}>
        <aside style={{ display: 'grid', gap: 20, position: 'sticky', top: 24 }}>
          <Facet title="Type" options={['Guide', 'App', 'Article']} />
          <Separator />
          <Facet title="Topic" options={['Coaching', 'Education', 'Food', 'AI']} />
          <Separator />
          <Facet title="Price" options={['Free', 'Under $10', '$10 and up']} />
        </aside>
        <div>
          <p className="t-caption" style={{ margin: '0 0 12px' }} aria-live="polite">{loading ? 'Searching…' : results.length + ' results for “' + q + '”'}</p>
          {loading ? (
            <div style={{ display: 'grid', gap: 16 }}>{[0, 1, 2].map((i) => <div key={i} style={{ display: 'grid', gap: 8 }}><Skeleton width="40%" height={18} /><Skeleton width="90%" height={14} /><Skeleton width="30%" height={14} /></div>)}</div>
          ) : results.length === 0 ? (
            <EmptyState title={'Nothing matches “' + q + '”'} description="Try a broader word, or drop a filter. Search covers titles, blurbs and tags." action={<Button variant="secondary" onClick={() => run('coaching')}>Reset the search</Button>} />
          ) : view === 'list' ? (
            <div style={{ display: 'grid' }}>
              {results.map((r) => (
                <a key={r.title} href="#" style={{ display: 'grid', gap: 6, padding: '18px 0', borderTop: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>{r.title}</span>
                    <Badge>{r.type}</Badge>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 14 }}>{r.price}</span>
                  </div>
                  <p className="t-body-sm" style={{ margin: 0 }}>{r.blurb}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Rating value={r.rating} />{r.tags.map((t) => <span key={t} className="t-caption">{t}</span>)}</div>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {results.map((r) => (
                <a key={r.title} href="#" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, textDecoration: 'none', color: 'inherit', display: 'grid', gap: 8, background: 'var(--surface)' }}>
                  <Badge>{r.type}</Badge>
                  <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>{r.title}</span>
                  <p className="t-body-sm" style={{ margin: 0 }}>{r.blurb}</p>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{r.price}</span>
                </a>
              ))}
            </div>
          )}
          {results.length && !loading ? <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}><Pagination page={page} pageCount={4} onPageChange={setPage} /></div> : null}
        </div>
      </div>
    </div>
  );
};
Object.assign(window, { SearchKit });
