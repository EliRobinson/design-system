const { ChatThread, ChatMessage, StreamingCaret, ChatComposer, PromptSuggestions, Button, Badge, Avatar, Eyebrow, Separator, EmptyState, Sheet } = window.MiltinsonDesignSystem_e160cb;

/* ChatThread / ChatMessage / StreamingCaret are @elirobinson/react's `ai` tier,
   and this kit calls them with their shipped props. ChatComposer and
   PromptSuggestions are still the project's own — see PROJECT_OWNED_COMPONENTS
   in packages/ai-patterns/scripts/build-design-project.mjs.

   The shipped ChatMessage has no `role`. Identity is `name` plus a required
   `avatar` node, so this kit keeps `role` in its OWN state (it is the kit's
   domain model) and maps it to `variant` / `name` / `avatar` at the call site.
   `variant` is presentation — which side of the conversation a turn is on — and
   is deliberately not an author enum. */
const AUTHOR = {
  user: { variant: 'sent', name: 'Eli', avatar: 'E' },
  assistant: { variant: 'received', name: 'Assistant', avatar: '◆' },
};

const STARTERS = ['Draft a 45-minute U10s session', 'Summarise my sales this month', 'Explain what an LLM actually does', 'Rewrite this email to be shorter'];

const CANNED = {
  default: "Here's a starting point — three phases, ten minutes each, and a cool-down. Keep the rondo short; kids lose the thread when a drill runs long.",
};

const ThreadList = ({ active, onSelect }) => {
  const threads = [
    { id: 't1', title: 'U10s session plan', when: '2m ago' },
    { id: 't2', title: 'Store copy rewrite', when: 'Yesterday' },
    { id: 't3', title: 'Stripe payout question', when: 'Tue' },
  ];
  return (
    <aside style={{ width: 260, borderRight: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 20, letterSpacing: "-0.025em" }}>Miltinson<span style={{ color: "var(--signal-500)" }}>.</span></span>
        <Button size="sm" onClick={() => onSelect('new')}>New chat</Button>
      </div>
      <Separator />
      <nav style={{ padding: 8, display: 'grid', gap: 2 }}>
        {threads.map((t) => (
          <button type="button" key={t.id} onClick={() => onSelect(t.id)} style={{ textAlign: 'left', border: 'none', borderRadius: 'var(--radius-sm)', background: active === t.id ? 'var(--surface)' : 'transparent', padding: '10px 12px', minHeight: 44, cursor: 'pointer', display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 14, color: 'var(--fg)' }}>{t.title}</span>
            <span className="t-caption">{t.when}</span>
          </button>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar alt="Eli Robinson" fallback="ER" size="sm" />
        <span style={{ fontSize: 13 }}>Eli Robinson</span>
      </div>
    </aside>
  );
};

const SourcesPanel = ({ open, onOpenChange }) => (
  <Sheet open={open} onOpenChange={onOpenChange} side="right" title="Sources" description="What this answer was based on.">
    <div style={{ display: 'grid', gap: 12 }}>
      {['Session Plans for U10s — p.12', 'Practice Drills Vol. 1 — p.4', 'FA youth guidance (2024)'].map((s, i) => (
        <a key={s} href="#" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <span className="ds-chat-citation" style={{ margin: 0 }}>{i + 1}</span>
          <span style={{ fontSize: 14, color: 'var(--fg)' }}>{s}</span>
        </a>
      ))}
    </div>
  </Sheet>
);

const Assistant = () => {
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [sources, setSources] = React.useState(false);
  const [thread, setThread] = React.useState('new');

  const send = (text) => {
    const q = (text || draft).trim();
    if (!q) return;
    setDraft('');
    setMessages((m) => m.concat([{ role: 'user', text: q }, { role: 'assistant', text: '', streaming: true }]));
    setBusy(true);
    const full = CANNED.default;
    let i = 0;
    const tick = setInterval(() => {
      i += 3;
      setMessages((m) => {
        const next = m.slice();
        next[next.length - 1] = { role: 'assistant', text: full.slice(0, i), streaming: i < full.length };
        return next;
      });
      if (i >= full.length) { clearInterval(tick); setBusy(false); }
    }, 24);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <ThreadList active={thread} onSelect={(id) => { setThread(id); setMessages([]); }} />
      <div className="ds-chat" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 56, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px' }}>
          <span className="t-h5">Assistant</span>
          <Badge variant="signal">Beta</Badge>
          <div style={{ marginLeft: 'auto' }}><Button variant="ghost" size="sm" onClick={() => setSources(true)}>Sources</Button></div>
        </div>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 32 }}>
            <div style={{ display: 'grid', gap: 20, maxWidth: 620, justifyItems: 'center', textAlign: 'center' }}>
              <Eyebrow>Miltinson Assistant</Eyebrow>
              <h2 className="t-h2" style={{ margin: 0 }}>What are we working on?</h2>
              <p className="t-body" style={{ color: 'var(--fg-2)', margin: 0 }}>It knows your guides, your store and your calendar. It will say so when it doesn't know something.</p>
              <PromptSuggestions suggestions={STARTERS} onSelect={send} />
            </div>
          </div>
        ) : (
          <ChatThread label="Assistant transcript">
            {messages.map((m, i) => {
              const settled = m.role === 'assistant' && !m.streaming;
              return (
                <ChatMessage key={i} {...AUTHOR[m.role]}
                  /* `actions` is a node, not an [{ label, onClick }] array: the
                     system does not own the control, so it does not own the
                     label or the handler either. Absent when there is nothing
                     to offer — ChatMessage renders no actions element at all. */
                  actions={settled ? (
                    <React.Fragment>
                      <Button variant="ghost" size="sm">Copy</Button>
                      <Button variant="ghost" size="sm">Retry</Button>
                      <Button variant="ghost" size="sm" onClick={() => setSources(true)}>Sources</Button>
                    </React.Fragment>
                  ) : undefined}>
                  {m.text}
                  {/* No `streaming` prop and no `citations` prop. The caret is a
                      real component the caller mounts and unmounts, and the
                      citation chips are this kit's own markup — which is what
                      keeps product copy out of the component. */}
                  {m.streaming ? <StreamingCaret label="Still writing" /> : null}
                  {settled ? (
                    <span style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {['Session Plans for U10s', 'Practice Drills Vol. 1'].map((title, n) => (
                        <a key={title} href="#" className="ds-chat-citation" title={title} onClick={(e) => { e.preventDefault(); setSources(true); }}>{n + 1}</a>
                      ))}
                    </span>
                  ) : null}
                </ChatMessage>
              );
            })}
          </ChatThread>
        )}
        <ChatComposer value={draft} onValueChange={setDraft} onSend={() => send()} busy={busy} />
      </div>
      <SourcesPanel open={sources} onOpenChange={setSources} />
    </div>
  );
};
Object.assign(window, { Assistant, ThreadList, SourcesPanel });
