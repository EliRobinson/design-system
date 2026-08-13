import type { Metadata } from 'next';

import { BrandArtifactCard } from '../../../../components/brand/BrandArtifactCard';
import { slideArtifacts } from '../../../../lib/brand';

export const metadata: Metadata = { title: 'Slide templates' };

export default function BrandSlidesPage() {
  return (
    <>
      <h1>Slide templates</h1>
      <p className="lead">
        The 16:9 deck templates — repo-only marketing collateral, not part of the published package.
        Each frame renders the real template at its fixed 1280×720 viewport.
      </p>
      {slideArtifacts().map((slide) => (
        <BrandArtifactCard key={slide.id} artifact={slide} />
      ))}
    </>
  );
}
