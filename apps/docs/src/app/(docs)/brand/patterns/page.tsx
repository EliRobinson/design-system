import type { Metadata } from 'next';

import { BrandArtifactCard } from '../../../../components/brand/BrandArtifactCard';
import { patternArtifacts } from '../../../../lib/brand';

export const metadata: Metadata = { title: 'Brand patterns' };

export default function BrandPatternsPage() {
  return (
    <>
      <h1>Brand patterns</h1>
      <p className="lead">
        Email, invoice, and social-carousel starters — repo-only collateral rendered from the real
        files.
      </p>
      {patternArtifacts().map((pattern) => (
        <BrandArtifactCard key={pattern.id} artifact={pattern} />
      ))}
    </>
  );
}
