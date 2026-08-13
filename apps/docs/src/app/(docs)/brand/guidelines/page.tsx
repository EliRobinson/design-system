import type { Metadata } from 'next';

import { BrandArtifactCard } from '@/components/brand/BrandArtifactCard';
import { guidelineCardGroups } from '@/lib/brand';

export const metadata: Metadata = { title: 'Brand guidelines' };

export default function BrandGuidelinesPage() {
  return (
    <>
      <h1>Brand guidelines</h1>
      <p className="lead">
        The guideline cards from <code>design-system-docs/</code>, rendered live — each frame is the
        real file, not a reproduction that could drift from it. Cards marked <em>generated</em>{' '}
        enumerate the token scale and rebuild from <code>tokens.css</code>; the rest are editorial
        writing.
      </p>
      {guidelineCardGroups().map(({ group, cards }) => (
        <section key={group}>
          <h2>{group}</h2>
          {cards.map((card) => (
            <BrandArtifactCard key={card.id} artifact={card} />
          ))}
        </section>
      ))}
    </>
  );
}
