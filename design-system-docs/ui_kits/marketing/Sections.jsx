/* eslint-disable react/jsx-no-undef --
   Eyebrow, Button, RuleLink and Tag are defined by _shared/Primitives.jsx. These kits are loaded as
   classic <script type="text/babel"> tags (see the index.html beside this
   file), in dependency order, sharing one global scope — so there is nothing
   to import and no module boundary to import it across.

   The directive is here because ds-resync writes this file into a consuming
   repo's .claude/skills/, a directory most projects lint, where the same code
   is indistinguishable from a module with missing imports. Scoped to the one
   rule so everything else about these samples is still linted. #119 */
/* global window, KIT_CONTENT -- a browser script: the kits publish their components
   onto window for the sibling kit files loaded after them, and read their strings from
   _shared/content.js, which is loaded first. See index.html. */
const copy = KIT_CONTENT.marketing;
const Hero = () => (
  <section
    style={{
      padding: '96px max(20px, 4vw) 80px',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      position: 'relative',
    }}
  >
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
      <h1
        style={{
          fontFamily: 'Geist, sans-serif',
          fontWeight: 600,
          fontSize: 'clamp(56px, 9vw, 112px)',
          lineHeight: 1.02,
          letterSpacing: '-0.03em',
          margin: '20px 0 0',
          maxWidth: 1100,
        }}
      >
        {copy.hero.headline}{' '}
        <span
          style={{
            background: 'linear-gradient(transparent 65%, var(--signal-300) 65%)',
          }}
        >
          {copy.hero.headlineAccent}
        </span>
      </h1>
      <p
        style={{
          fontFamily: 'Geist, sans-serif',
          fontSize: 22,
          color: 'var(--fg-2)',
          lineHeight: 1.5,
          maxWidth: 720,
          margin: '32px 0 0',
        }}
      >
        {copy.hero.standfirst}
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
        <Button variant="primary" size="lg" icon>
          {copy.hero.primaryCta}
        </Button>
        <Button variant="secondary" size="lg">
          {copy.hero.secondaryCta}
        </Button>
      </div>
    </div>
  </section>
);

const FeaturedApps = () => {
  const apps = copy.featured.apps;
  return (
    <section style={{ padding: '96px max(20px, 4vw)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 40,
          }}
        >
          <h2
            style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 600,
              fontSize: 48,
              letterSpacing: '-0.025em',
              margin: 0,
            }}
          >
            {copy.featured.heading}
          </h2>
          <RuleLink>{copy.featured.viewAll}</RuleLink>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {apps.map((app, i) => (
            <a
              key={i}
              href="#"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 24,
                background: 'var(--surface)',
                transition: 'all 220ms cubic-bezier(0.22,1,0.36,1)',
                display: 'block',
              }}
            >
              <div
                style={{
                  aspectRatio: '16/10',
                  borderRadius: 4,
                  background:
                    app.thumb === 'recipes'
                      ? 'linear-gradient(0deg, var(--signal-100), var(--signal-50))'
                      : 'var(--ink-1000)',
                  display: 'grid',
                  placeItems: 'center',
                  color: app.thumb === 'recipes' ? 'inherit' : 'var(--ink-0)',
                  fontFamily: app.thumb === 'recipes' ? 'inherit' : 'JetBrains Mono, monospace',
                  fontSize: app.thumb === 'recipes' ? 64 : 28,
                  marginBottom: 20,
                }}
              >
                {app.thumb === 'recipes' ? '🍳' : 'f(x) = mx + b'}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {app.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
              <h3
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontWeight: 600,
                  fontSize: 24,
                  letterSpacing: '-0.02em',
                  margin: '0 0 6px',
                }}
              >
                {app.title}
              </h3>
              <p
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontSize: 15,
                  color: 'var(--fg-2)',
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {app.body}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

const FeatureBand = () => (
  <section
    style={{
      padding: '96px max(20px, 4vw)',
      background: 'var(--anchor-900)',
      color: 'var(--ink-0)',
      borderBottom: '1px solid var(--border)',
    }}
  >
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '7fr 5fr',
        gap: 64,
        alignItems: 'center',
      }}
    >
      <div>
        <Eyebrow color="var(--fg-inverse-3)">{copy.feature.eyebrow}</Eyebrow>
        <h2
          style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 600,
            fontSize: 48,
            letterSpacing: '-0.025em',
            margin: '20px 0 16px',
            lineHeight: 1.05,
          }}
        >
          {copy.feature.heading}
        </h2>
        <p
          style={{
            fontFamily: 'Geist, sans-serif',
            fontSize: 18,
            color: 'var(--fg-inverse-2)',
            lineHeight: 1.6,
            margin: '0 0 32px',
            maxWidth: 560,
          }}
        >
          {copy.feature.body}
        </p>
        <Button variant="accent" size="lg" icon>
          {copy.feature.cta}
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 140,
              height: 200,
              background: i === 1 ? 'var(--signal-100)' : 'var(--ink-50)',
              borderRadius: 4,
              transform: `rotate(${(i - 1) * 4}deg) translateY(${i === 1 ? -8 : 0}px)`,
              boxShadow: '0 18px 40px -12px color-mix(in oklch, var(--ink-1000) 50%, transparent)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                letterSpacing: '0.16em',
                color: 'var(--anchor-700)',
              }}
            >
              {copy.feature.cardLabel} · 0{i + 1}
            </div>
            <div
              style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 600,
                fontSize: 14,
                color: 'var(--ink-1000)',
                letterSpacing: '-0.015em',
                lineHeight: 1.2,
              }}
            >
              {copy.feature.cards[i]}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ServicesBand = () => (
  <section style={{ padding: '96px max(20px, 4vw)' }}>
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {copy.services.items.map((s, i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 32,
              background: 'var(--surface)',
            }}
          >
            <Eyebrow>{s.eb}</Eyebrow>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 6,
                marginTop: 16,
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color: 'var(--fg-3)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                From
              </span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 500,
                  fontSize: 38,
                  letterSpacing: '-0.02em',
                }}
              >
                ${s.price}
              </span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  color: 'var(--fg-2)',
                }}
              >
                /hr
              </span>
            </div>
            <p
              style={{
                fontFamily: 'Geist, sans-serif',
                fontSize: 16,
                color: 'var(--fg-2)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {s.body}
            </p>
            <div style={{ marginTop: 24 }}>
              <RuleLink>{copy.services.detailsLink}</RuleLink>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

Object.assign(window, { Hero, FeaturedApps, FeatureBand, ServicesBand });
