/* global window, React, KIT_CONTENT -- a browser script: it reads the real components
   from window.DesignSystem (ds-bundle.js) and its strings from _shared/content.js, and
   publishes onto window for the inline script in index.html. */
/*
 * Three phone screens. Each frame sets data-platform="mobile", the token layer that
 * tightens radii, the small end of the type ramp and the gutter for small screens. The
 * screens are @elirobinson/react components; the frame is the only thing drawn here.
 *
 * Emoji appear only in the recipe list: the playful sub-brand is the one place the brand
 * rules allow them.
 */

const {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Eyebrow,
  Progress,
  RadioGroup,
  RadioGroupItem,
  SearchField,
  Separator,
  Switch,
} = window.DesignSystem;
const { Fragment } = React;
const phone = KIT_CONTENT.mobile;

const column = (gap) => ({ display: 'flex', flexDirection: 'column', gap: `var(--space-${gap})` });
const cluster = (gap) => ({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: `var(--space-${gap})` });

function PhoneFrame({ label, children }) {
  return (
    <figure style={{ ...column(3), margin: 0, alignItems: 'center' }}>
      <div
        data-platform="mobile"
        style={{
          width: 375,
          height: 780,
          boxSizing: 'border-box',
          overflowY: 'auto',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          background: 'var(--bg)',
          color: 'var(--fg)',
          padding: 'var(--space-9) var(--space-4) var(--space-6)',
        }}
      >
        {children}
      </div>
      <figcaption className="t-caption" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
        {label}
      </figcaption>
    </figure>
  );
}

function BrowseScreen() {
  const copy = phone.browse;
  const [filter, setFilter] = React.useState(copy.filters[0]);
  const [query, setQuery] = React.useState('');
  const items = copy.items
    .filter((item) => filter === copy.filters[0] || item.tag === filter)
    .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={column(4)}>
      <div style={column(1)}>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="t-h3" style={{ margin: 0 }}>
          {copy.heading}
        </h1>
        <p className="t-body-sm" style={{ margin: 0, color: 'var(--fg-2)' }}>
          {copy.standfirst}
        </p>
      </div>
      <SearchField aria-label={copy.search} placeholder={copy.search} value={query} onValueChange={setQuery} />
      <div role="group" aria-label={copy.filtersLabel} style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-1)' }}>
        {copy.filters.map((name) => (
          <Button key={name} size="sm" variant={name === filter ? 'primary' : 'secondary'} aria-pressed={name === filter} onClick={() => setFilter(name)}>
            {name}
          </Button>
        ))}
      </div>
      {items.length === 0 && (
        <p className="t-body-sm" style={{ color: 'var(--fg-3)' }}>
          {copy.empty}
        </p>
      )}
      <ul style={{ ...column(3), listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li key={item.name}>
            <Card>
              <CardContent>
                <div style={cluster(3)}>
                  <span aria-hidden="true" className="t-h3" style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)' }}>
                    {item.emoji}
                  </span>
                  <div style={{ ...column(1), flex: 1, minWidth: 0 }}>
                    <span className="t-body" style={{ fontWeight: 'var(--fw-medium)' }}>
                      {item.name}
                    </span>
                    <span className="t-caption" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                      {item.time} · {item.diff}
                    </span>
                  </div>
                  <Badge variant="outline">{item.tag}</Badge>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PracticeScreen() {
  const copy = phone.practice;
  const [answer, setAnswer] = React.useState(null);
  const [checked, setChecked] = React.useState(false);
  const result = answer === copy.correct ? copy.right : copy.wrong;
  return (
    <div style={column(5)}>
      <div style={{ ...cluster(2), justifyContent: 'space-between' }}>
        <span className="t-caption" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
          {copy.progressLabel}
        </span>
        <Badge variant="signal">{copy.streak}</Badge>
      </div>
      <Progress value={copy.progress} label={copy.progressLabel} />
      <Eyebrow>{copy.topic}</Eyebrow>
      <p className="t-h1" style={{ margin: 0, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
        {copy.question}
      </p>
      <RadioGroup
        name="answer"
        aria-label={copy.answersLabel}
        value={answer}
        onValueChange={(value) => {
          setAnswer(value);
          setChecked(false);
        }}
      >
        {copy.answers.map((option) => (
          <RadioGroupItem key={option} value={option} label={option} />
        ))}
      </RadioGroup>
      <Button variant="accent" size="lg" disabled={!answer} onClick={() => setChecked(true)}>
        {copy.check}
      </Button>
      {checked && (
        <Alert variant={answer === copy.correct ? 'success' : 'warning'} title={result.title}>
          {result.body}
        </Alert>
      )}
    </div>
  );
}

function AccountScreen() {
  const copy = phone.account;
  return (
    <div style={column(5)}>
      <div style={cluster(3)}>
        <Avatar alt={copy.name} fallback={copy.initials} size="lg" />
        <div style={column(1)}>
          <span className="t-h4">{copy.name}</span>
          <div>
            <Badge variant="anchor">{copy.plan}</Badge>
          </div>
        </div>
      </div>
      <Card>
        <CardContent>
          <h2 className="t-eyebrow" style={{ margin: '0 0 var(--space-2)', color: 'var(--fg-2)' }}>
            {copy.settingsLabel}
          </h2>
          {copy.settings.map((setting, index) => (
            <Fragment key={setting.label}>
              {index > 0 && <Separator />}
              {/* The row's text names the switch, so the switch draws no label of its own. */}
              <div style={{ ...cluster(3), justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <span className="t-body-sm" aria-hidden="true">
                  {setting.label}
                </span>
                <Switch label={setting.label} hideLabel defaultChecked={setting.on} />
              </div>
            </Fragment>
          ))}
        </CardContent>
      </Card>
      <Button variant="secondary">{copy.signOut}</Button>
    </div>
  );
}

Object.assign(window, { PhoneFrame, BrowseScreen, PracticeScreen, AccountScreen });
