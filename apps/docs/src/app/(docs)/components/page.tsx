import type { Metadata } from 'next';
import Link from 'next/link';

import { TIERS, componentsByTier, hooks } from '../../../lib/manifest';

export const metadata: Metadata = { title: 'Components' };

const TIER_INTRO: Record<string, string> = {
  atoms: 'Single-purpose primitives — not further divisible.',
  molecules:
    'A few atoms combined into one functional unit, with no portal or overlay orchestration.',
  organisms:
    'Compound components with internal state or overlay orchestration — portals, focus management, keyboard navigation.',
};

export default function ComponentsIndexPage() {
  return (
    <>
      <h1>Components</h1>
      <p className="lead">
        All 44 components, grouped by atomic tier. Every page carries live demos, a generated props
        table, the exact import subpath, and the keyboard contract you inherit. The{' '}
        <Link href="/guidelines/tiers">tier boundary</Link> is a rule, not a vibe.
      </p>
      {TIERS.map((tier) => {
        const tierComponents = componentsByTier(tier);
        return (
          <section key={tier}>
            <h2>
              {tier} ({tierComponents.length})
            </h2>
            <p>{TIER_INTRO[tier]}</p>
            <div className="component-index__grid">
              {tierComponents.map((component) => (
                <Link
                  key={component.slug}
                  href={`/components/${component.slug}`}
                  className="related-card"
                >
                  <span className="related-card__name">{component.name}</span>
                  <span className="related-card__description">{component.description}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      <section>
        <h2>Interaction hooks ({hooks.length})</h2>
        <p>
          The keyboard behaviors the organisms share, exported for when you build your own composite
          widgets — see <Link href="/components/hooks">interaction hooks</Link>.
        </p>
      </section>
    </>
  );
}
