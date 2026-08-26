import type { Metadata } from 'next';
import Link from 'next/link';

import { TIER_INTRO } from '../../../lib/editorial';
import { TIERS, components, componentsByTier, hooks } from '../../../lib/manifest';

export const metadata: Metadata = { title: 'Components' };

export default function ComponentsIndexPage() {
  return (
    <>
      <h1>Components</h1>
      <p className="lead">
        All {components.length} components, grouped by atomic tier. Every page carries live demos, a
        generated props table, the exact import subpath, and the keyboard contract you inherit.
        Which tier a component lands in is decided by the{' '}
        <Link href="/guidelines/tiers">tier boundary</Link>, four questions asked in order.
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
