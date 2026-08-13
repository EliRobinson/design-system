import Link from 'next/link';

import { components, hooks } from '../lib/manifest';
import { publishedPackages } from '../lib/published-packages';
import { firstPageOf, pageByTitle } from '../lib/site-map';
import { cssTokens } from '../lib/tokens-css';

const PRINCIPLES = [
  {
    title: 'Ink-led, one loud color',
    body: 'Black type, white surfaces, hairline borders. Miltinson Amber is the only shout — a signal, never a fill.',
  },
  {
    title: 'Sharp, not pillowy',
    body: '4–6px radii, borders doing the work shadows usually do, and motion that confirms instead of performing.',
  },
  {
    title: 'Accessible by default',
    body: 'WCAG AA pairings, 16px minimum text, visible focus rings, scoped touch targets, reduced motion honored — built into the tokens, not bolted on.',
  },
  {
    title: 'Agents are users too',
    body: 'A generated manifest feeds the props tables, the search index, and machine-readable endpoints — so an AI writing against this system imports the right thing on the first try.',
  },
];

export default function HomePage() {
  const stats = [
    { value: components.length, label: 'components' },
    { value: hooks.length, label: 'interaction hooks' },
    { value: new Set(cssTokens().map((t) => t.name)).size, label: 'design tokens' },
    { value: publishedPackages().length, label: 'published packages' },
  ];

  /* Card prose is editorial; every count and href derives from the manifest
     and the site sections, so a moved or renamed section fails the build here
     rather than 404ing. */
  const sections = [
    {
      title: 'Foundations',
      href: firstPageOf('Foundations').href,
      body: 'Color, type, spacing, radii, motion — rendered live from the tokens package.',
    },
    {
      title: 'Components',
      href: firstPageOf('Components').href,
      body: `All ${components.length} components with live demos, generated props tables, and keyboard contracts.`,
    },
    {
      title: 'Patterns',
      href: firstPageOf('Patterns').href,
      body: 'Header, hero, forms, data display — recipes composed from primitives.',
    },
    {
      title: 'Guidelines',
      href: firstPageOf('Guidelines').href,
      body: 'Voice, the accessibility standard, tier boundaries, and how to contribute.',
    },
    {
      title: 'Build with AI',
      href: firstPageOf('Build with AI').href,
      body: 'llms.txt, per-component JSON, and prompt templates that ship with the packages.',
    },
    {
      title: 'Installation',
      href: pageByTitle('Installation').href,
      body: 'GitHub Packages auth, two imports, and the starter generator.',
    },
  ];

  return (
    <main>
      <section className="home-hero">
        <div className="home-hero__inner">
          <p className="t-eyebrow home-hero__eyebrow">Miltinson Design System</p>
          <h1 className="home-hero__title">
            Practical components, honestly built<span className="home-hero__dot">.</span>
          </h1>
          <p className="home-hero__lead">
            I run several small products under one name, and this system keeps them consistent and
            fast to ship — tokens, React components, and AI patterns that work the same way in every
            app. No fluff, no dark patterns, accessible by default.
          </p>
          <div className="home-hero__actions">
            <Link className="ds-button ds-button--accent ds-button--lg" href="/installation">
              Get started
            </Link>
            <Link className="home-hero__secondary" href="/components">
              Browse components
            </Link>
          </div>
          <dl className="home-hero__stats">
            {stats.map((stat) => (
              <div key={stat.label} className="home-hero__stat">
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="home-section">
        <h2>What the system believes</h2>
        <div className="home-grid">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title} className="home-card">
              <h3>{principle.title}</h3>
              <p>{principle.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2>Find your way in</h2>
        <div className="home-grid">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="home-card home-card--link">
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2>Pointing an agent at this?</h2>
        <p className="home-ai-note">
          Fetch <a href="/llms.txt">/llms.txt</a> for the index,{' '}
          <a href="/llms-full.txt">/llms-full.txt</a> for the whole corpus, or{' '}
          <code>/r/&lt;component&gt;.json</code> for one component&apos;s machine-readable record.
          Import paths in those files are real — they resolve against the published packages.
        </p>
      </section>
    </main>
  );
}
