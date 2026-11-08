/* eslint-disable react/jsx-no-undef --
   Icon is defined by _shared/Kit.jsx. These kits are loaded as classic
   <script type="text/babel"> tags (see the index.html beside this file), in dependency
   order, sharing one global scope, so there is nothing to import. The directive is here
   because ds-resync writes this file into a consuming repo's .claude/skills/, a directory
   most projects lint. Scoped to the one rule so everything else is still linted. #119 */
/* global window, column, cluster, grid, Icon, ICONS, React, KIT_CONTENT -- a browser script: it reads the real components
   from window.DesignSystem (ds-bundle.js) and its strings from _shared/content.js, and
   publishes onto window for the inline script in index.html. */
/*
 * The homepage sections: hero, featured apps, the flagship band, services, questions and
 * the sign-up. Every control and card is an @elirobinson/react component.
 */

const {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Eyebrow,
  Input,
  RuleLink,
} = window.DesignSystem;
const page = KIT_CONTENT.marketing;

const section = (extra) => ({
  maxWidth: 'var(--shell-xl)',
  margin: '0 auto',
  padding: 'var(--space-12) var(--space-7)',
  boxSizing: 'border-box',
  ...extra,
});


function Hero() {
  const copy = page.hero;
  return (
    <section style={section({ ...column(6), paddingTop: 'var(--space-13)' })}>
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <h1 className="t-display-1" style={{ margin: 0, maxWidth: '14ch' }}>
        {copy.headline} <span style={{ color: 'var(--accent-ink)' }}>{copy.headlineAccent}</span>
      </h1>
      <p className="t-lead" style={{ margin: 0, maxWidth: '52ch', color: 'var(--fg-2)' }}>
        {copy.standfirst}
      </p>
      <div style={cluster(3)}>
        <Button variant="accent" size="lg">
          {copy.primaryCta}
        </Button>
        <Button variant="secondary" size="lg">
          {copy.secondaryCta}
        </Button>
      </div>
    </section>
  );
}

function FeaturedApps() {
  const copy = page.featured;
  return (
    <section style={section(column(6))}>
      <div style={{ ...cluster(4), justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="t-h2" style={{ margin: 0 }}>
          {copy.heading}
        </h2>
        <RuleLink href="#">{copy.viewAll}</RuleLink>
      </div>
      <div style={grid(420, 6)}>
        {copy.apps.map((app) => (
          <Card key={app.title}>
            <div
              aria-hidden="true"
              className="t-display-2"
              style={{
                aspectRatio: '16 / 10',
                display: 'grid',
                placeItems: 'center',
                background: 'var(--bg-muted)',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-2)',
              }}
            >
              {app.mark}
            </div>
            <CardHeader>
              <div style={{ ...cluster(2), justifyContent: 'space-between' }}>
                <CardTitle>{app.title}</CardTitle>
                <Badge variant="signal">{app.status}</Badge>
              </div>
              <CardDescription>{app.body}</CardDescription>
            </CardHeader>
            <CardFooter>
              <div style={{ ...cluster(2), justifyContent: 'space-between', width: '100%' }}>
                <div style={cluster(2)}>
                  {app.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <RuleLink href="#">{copy.open}</RuleLink>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* The flagship band sits on the inverse surface: its own text uses the inverse tokens,
   and the cards keep their own surface. */
function FeatureBand() {
  const copy = page.feature;
  return (
    <div style={{ background: 'var(--bg-inverse)', color: 'var(--fg-inverse)' }}>
      <section style={section({ ...grid(340, 9), alignItems: 'center' })}>
        <div style={column(5)}>
          <Eyebrow style={{ color: 'var(--accent-ink-inverse)' }}>{copy.eyebrow}</Eyebrow>
          <h2 className="t-h1" style={{ margin: 0, color: 'var(--fg-inverse)' }}>
            {copy.heading}
          </h2>
          <p className="t-body" style={{ margin: 0, color: 'var(--fg-inverse-2)', maxWidth: '48ch' }}>
            {copy.body}
          </p>
          <div>
            <Button variant="accent">{copy.cta}</Button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
          {copy.cards.map((guide) => (
            <Card key={guide.title} style={{ aspectRatio: '3 / 4' }}>
              <CardContent>
                <div style={{ ...column(3), height: '100%' }}>
                  <Eyebrow>{copy.cardLabel}</Eyebrow>
                  <span className="t-h5">{guide.title}</span>
                  <span className="t-caption" style={{ marginTop: 'auto', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                    {guide.meta}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function ServicesBand() {
  const copy = page.services;
  return (
    <section style={section(column(6))}>
      <h2 className="t-h2" style={{ margin: 0 }}>
        {copy.heading}
      </h2>
      <div style={grid(360, 6)}>
        {copy.items.map((service) => (
          <Card key={service.eb}>
            <CardHeader>
              <Eyebrow>{service.eb}</Eyebrow>
              <CardTitle>
                <span className="t-caption" style={{ color: 'var(--fg-2)' }}>
                  {copy.pricePrefix}{' '}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {service.price}
                  {copy.priceUnit}
                </span>
              </CardTitle>
              <CardDescription>{service.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul style={{ ...column(2), listStyle: 'none', margin: 0, padding: 0 }}>
                {service.points.map((point) => (
                  <li key={point} className="t-body-sm" style={cluster(2)}>
                    <span style={{ color: 'var(--accent-ink)', display: 'inline-flex' }}>
                      <Icon d={ICONS.check} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <RuleLink href="#">{copy.detailsLink}</RuleLink>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Questions() {
  const copy = page.faq;
  return (
    <section style={section({ ...column(6), maxWidth: 'var(--shell-md)', paddingTop: 0 })}>
      <h2 className="t-h2" style={{ margin: 0 }}>
        {copy.heading}
      </h2>
      <Accordion type="single" defaultValue={copy.items[0].q} headingLevel={3}>
        {copy.items.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger>{item.q}</AccordionTrigger>
            <AccordionContent>{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function SignUp() {
  const copy = page.newsletter;
  const [email, setEmail] = React.useState('');
  return (
    <section style={section({ paddingTop: 0 })}>
      <Card>
        <CardContent>
          <form
            onSubmit={(event) => event.preventDefault()}
            style={{ ...grid(320, 6), alignItems: 'end' }}
          >
            <div style={column(2)}>
              <h2 className="t-h3" style={{ margin: 0 }}>
                {copy.heading}
              </h2>
              <p className="t-body" style={{ margin: 0, color: 'var(--fg-2)' }}>
                {copy.body}
              </p>
            </div>
            <div style={{ ...cluster(3), alignItems: 'flex-end', flexWrap: 'nowrap' }}>
              <div style={{ flex: 1 }}>
                <Input label={copy.label} type="email" placeholder={copy.placeholder} value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <Button type="submit" variant="accent">
                {copy.cta}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

Object.assign(window, { Hero, FeaturedApps, FeatureBand, ServicesBand, Questions, SignUp });
