const { Button, Input, Checkbox, Alert, Separator, Eyebrow, RuleLink, Stepper, Kbd, Spinner } = window.MiltinsonDesignSystem_e160cb;

const Frame = ({ children, aside }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
    <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <span style={{ fontWeight: 600, fontSize: 24, letterSpacing: '-0.025em' }}>Miltinson<span style={{ color: 'var(--signal-500)' }}>.</span></span>
        <div style={{ marginTop: 32 }}>{children}</div>
      </div>
    </div>
    <div style={{ background: 'var(--ink-1000)', color: 'var(--ink-0)', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', backgroundImage: 'url(../../assets/pattern-dotgrid.svg)', backgroundSize: '20px 20px' }}>
      {aside}
    </div>
  </div>
);

const Aside = () => (
  <div style={{ maxWidth: 460 }}>
    <p className="t-eyebrow" style={{ color: 'oklch(100% 0 0 / 0.6)' }}>Miltinson Technologies</p>
    <p style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15, margin: '16px 0 12px' }}>Practical tech, honestly built.</p>
    <p style={{ color: 'oklch(100% 0 0 / 0.7)', lineHeight: 1.6, margin: 0 }}>One account across the guides store, the apps and the assistant.</p>
  </div>
);

const SignIn = ({ go, onSubmit, error, busy }) => (
  <Frame aside={<Aside />}>
    <h1 className="t-h3" style={{ margin: '0 0 8px' }}>Sign in</h1>
    <p className="t-body-sm" style={{ margin: '0 0 24px' }}>Welcome back. No account? <a href="#" onClick={(e) => { e.preventDefault(); go('signup'); }}>Create one</a>.</p>
    {error ? <div style={{ marginBottom: 16 }}><Alert variant="danger" title="That didn't work">Check the email and password and try again.</Alert></div> : null}
    <form style={{ display: 'grid', gap: 16 }} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Input label="Email" type="email" placeholder="you@example.com" autoComplete="email" />
      <Input label="Password" type="password" autoComplete="current-password" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Checkbox label="Keep me signed in" defaultChecked />
        <a href="#" style={{ fontSize: 14 }} onClick={(e) => { e.preventDefault(); go('forgot'); }}>Forgot password?</a>
      </div>
      <Button type="submit" size="lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
    </form>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
      <Separator /><span className="t-caption" style={{ whiteSpace: 'nowrap' }}>or</span><Separator />
    </div>
    <div style={{ display: 'grid', gap: 10 }}>
      <Button variant="secondary" size="lg" onClick={() => go('magic')}>Email me a sign-in link</Button>
      <Button variant="ghost" size="lg" onClick={() => go('sso')}>Continue with a work account</Button>
    </div>
    <p className="t-caption" style={{ marginTop: 24 }}>By signing in you agree to the <a href="#">terms</a> and <a href="#">privacy notice</a>.</p>
  </Frame>
);

const SignUp = ({ go }) => (
  <Frame aside={<Aside />}>
    <h1 className="t-h3" style={{ margin: '0 0 8px' }}>Create an account</h1>
    <p className="t-body-sm" style={{ margin: '0 0 24px' }}>Already have one? <a href="#" onClick={(e) => { e.preventDefault(); go('signin'); }}>Sign in</a>.</p>
    <div style={{ marginBottom: 24 }}><Stepper steps={[{ label: 'Account' }, { label: 'Verify' }, { label: 'Done' }]} activeStep={0} /></div>
    <form style={{ display: 'grid', gap: 16 }} onSubmit={(e) => { e.preventDefault(); go('verify'); }}>
      <Input label="Name" placeholder="Your name" autoComplete="name" />
      <Input label="Email" type="email" placeholder="you@example.com" autoComplete="email" />
      <Input label="Password" type="password" hint="At least 12 characters. A passphrase beats a puzzle." autoComplete="new-password" />
      <Checkbox label="Email me when a new guide is published" />
      <Button type="submit" size="lg">Create account</Button>
    </form>
  </Frame>
);

const Verify = ({ go }) => {
  const [code, setCode] = React.useState(['', '', '', '', '', '']);
  const set = (i, v) => setCode((c) => c.map((x, j) => (j === i ? v.replace(/\D/g, '').slice(-1) : x)));
  return (
    <Frame aside={<Aside />}>
      <h1 className="t-h3" style={{ margin: '0 0 8px' }}>Check your email</h1>
      <p className="t-body-sm" style={{ margin: '0 0 24px' }}>I sent a six-digit code to <b style={{ color: 'var(--fg)' }}>you@example.com</b>. It expires in ten minutes.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {code.map((c, i) => (
          <input key={i} inputMode="numeric" aria-label={'Digit ' + (i + 1)} value={c} onChange={(e) => set(i, e.target.value)}
            style={{ width: 52, height: 60, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 24, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--fg)' }} />
        ))}
      </div>
      <Button size="lg" onClick={() => go('done')}>Verify</Button>
      <p className="t-caption" style={{ marginTop: 16 }}>Didn't get it? <a href="#">Send another</a> — check spam first.</p>
    </Frame>
  );
};

const Forgot = ({ go }) => (
  <Frame aside={<Aside />}>
    <h1 className="t-h3" style={{ margin: '0 0 8px' }}>Reset your password</h1>
    <p className="t-body-sm" style={{ margin: '0 0 24px' }}>Tell me the email on the account and I'll send a reset link.</p>
    <form style={{ display: 'grid', gap: 16 }} onSubmit={(e) => { e.preventDefault(); go('magic'); }}>
      <Input label="Email" type="email" placeholder="you@example.com" />
      <Button type="submit" size="lg">Send reset link</Button>
      <Button variant="ghost" onClick={() => go('signin')}>Back to sign in</Button>
    </form>
  </Frame>
);

const MagicSent = ({ go }) => (
  <Frame aside={<Aside />}>
    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--signal-100)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', marginBottom: 20 }}>✓</div>
    <h1 className="t-h3" style={{ margin: '0 0 8px' }}>Link sent</h1>
    <p className="t-body-sm" style={{ margin: '0 0 24px' }}>Open it on this device and you're in. The link works once and expires in fifteen minutes.</p>
    <Button variant="secondary" onClick={() => go('signin')}>Back to sign in</Button>
  </Frame>
);

const SsoWait = ({ go }) => (
  <Frame aside={<Aside />}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}><Spinner size="sm" /><span className="t-body-sm" style={{ margin: 0 }}>Waiting for your provider…</span></div>
    <h1 className="t-h3" style={{ margin: '0 0 8px' }}>Continue in the other tab</h1>
    <p className="t-body-sm" style={{ margin: '0 0 24px' }}>I opened your work account provider. Nothing is shared beyond your name and email.</p>
    <Button variant="ghost" onClick={() => go('signin')}>Use a password instead</Button>
  </Frame>
);

const Done = ({ go }) => (
  <Frame aside={<Aside />}>
    <h1 className="t-h3" style={{ margin: '0 0 8px' }}>You're in</h1>
    <p className="t-body-sm" style={{ margin: '0 0 24px' }}>Account created. Next: pick what you want first.</p>
    <div style={{ display: 'grid', gap: 10 }}>
      <Button size="lg">Go to the dashboard</Button>
      <Button variant="secondary" size="lg" onClick={() => go('signin')}>Sign out</Button>
    </div>
  </Frame>
);

const Auth = () => {
  const [screen, setScreen] = React.useState('signin');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  const submit = () => { setBusy(true); setTimeout(() => { setBusy(false); setError(true); }, 700); };
  const map = { signin: <SignIn go={setScreen} onSubmit={submit} busy={busy} error={error} />, signup: <SignUp go={setScreen} />, verify: <Verify go={setScreen} />, forgot: <Forgot go={setScreen} />, magic: <MagicSent go={setScreen} />, sso: <SsoWait go={setScreen} />, done: <Done go={setScreen} /> };
  return map[screen];
};
Object.assign(window, { Auth, Frame, SignIn, SignUp, Verify, Forgot, MagicSent, SsoWait, Done });
