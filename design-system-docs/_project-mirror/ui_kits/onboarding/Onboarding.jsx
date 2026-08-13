const { Button, Input, Stepper, Progress, RadioGroup, Checkbox, Card, CardContent, Badge, Chip, Select, Alert, Separator } = window.MiltinsonDesignSystem_e160cb;

const STEPS = [{ label: 'You' }, { label: 'Your work' }, { label: 'First product' }, { label: 'Done' }];

const Shell = ({ step, children, next, back, nextLabel = 'Continue', canSkip }) => (
  <div style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
    <header style={{ borderBottom: '1px solid var(--border)', padding: '16px max(20px, 4vw)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-0.025em' }}>Miltinson<span style={{ color: 'var(--signal-500)' }}>.</span></span>
      {canSkip ? <a href="#" style={{ fontSize: 14 }} onClick={(e) => { e.preventDefault(); next(); }}>Skip for now</a> : null}
    </header>
    <main style={{ display: 'grid', placeItems: 'start center', padding: '48px max(20px, 4vw)' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'grid', gap: 28 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Stepper steps={STEPS} activeStep={step} />
          <Progress value={((step + 1) / STEPS.length) * 100} />
        </div>
        {children}
      </div>
    </main>
    <footer style={{ borderTop: '1px solid var(--border)', padding: '16px max(20px, 4vw)', display: 'flex', justifyContent: 'space-between' }}>
      <Button variant="ghost" onClick={back} disabled={step === 0}>Back</Button>
      <Button onClick={next}>{nextLabel}</Button>
    </footer>
  </div>
);

const Onboarding = () => {
  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState('builder');
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  return (
    <Shell step={step} next={next} back={back} canSkip={step > 0 && step < 3} nextLabel={step === 2 ? 'Create it' : step === 3 ? 'Go to dashboard' : 'Continue'}>
      {step === 0 ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <div><h1 className="t-h3" style={{ margin: '0 0 6px' }}>First, who am I talking to?</h1><p className="t-body-sm" style={{ margin: 0 }}>Two questions, then you're in. You can change any of this later.</p></div>
          <Input label="Name" placeholder="Your name" />
          <Input label="What should the store say you do?" placeholder="Coach, teacher, indie builder…" hint="Shown on your public store page." />
        </div>
      ) : null}
      {step === 1 ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <div><h1 className="t-h3" style={{ margin: '0 0 6px' }}>What are you here to ship?</h1><p className="t-body-sm" style={{ margin: 0 }}>This only changes what I put on your dashboard first.</p></div>
          <RadioGroup name="role" value={role} onValueChange={setRole} options={[
            { label: 'Digital guides and PDFs', value: 'builder' },
            { label: 'An app or web product', value: 'app' },
            { label: 'Consulting and support hours', value: 'consulting' },
            { label: 'Still deciding', value: 'unsure' },
          ]} />
          <div>
            <span className="t-eyebrow">Topics</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {['Coaching', 'Education', 'Food', 'AI', 'Small business'].map((t) => <Chip key={t}>{t}</Chip>)}
            </div>
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <div><h1 className="t-h3" style={{ margin: '0 0 6px' }}>Let's put something in the store</h1><p className="t-body-sm" style={{ margin: 0 }}>A draft is enough — nothing goes live until you publish it.</p></div>
          <Input label="Product name" placeholder="Session Plans for U10s" />
          <Select label="Type" options={[{ label: 'PDF guide', value: 'pdf' }, { label: 'Bundle', value: 'bundle' }, { label: 'Booking', value: 'booking' }]} />
          <Input label="Price" placeholder="12" hint="In USD. You can change it whenever." />
          <Checkbox label="Email me when someone buys it" defaultChecked />
        </div>
      ) : null}
      {step === 3 ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--signal-100)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)' }}>✓</div>
          <div><h1 className="t-h3" style={{ margin: '0 0 6px' }}>That's the setup done</h1><p className="t-body-sm" style={{ margin: 0 }}>Your draft is saved. Three things worth doing next — none of them urgent.</p></div>
          <div style={{ display: 'grid', gap: 10 }}>
            {[['Add a cover image', 'Products with a cover sell about twice as often.'], ['Connect a payout account', 'Takes four minutes; needed before your first sale clears.'], ['Write the store blurb', 'Two sentences in your own voice beats a feature list.']].map(([t, d]) => (
              <div key={t} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                <div><div style={{ fontSize: 14, fontWeight: 500 }}>{t}</div><div className="t-caption">{d}</div></div>
                <Button variant="secondary" size="sm">Start</Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Shell>
  );
};
Object.assign(window, { Onboarding });
