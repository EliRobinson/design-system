import type { Metadata } from 'next';

import { BrandArtifactCard } from '@/components/brand/BrandArtifactCard';
import { brandAssets } from '@/lib/brand';

export const metadata: Metadata = { title: 'Brand assets' };

export default function BrandAssetsPage() {
  return (
    <>
      <h1>Brand assets</h1>
      <p className="lead">
        The wordmark, monogram, lockup, and dot-grid texture — the files consumers receive in the
        packed brand skill, rendered from the same source.
      </p>
      {brandAssets().map((asset) => (
        <BrandArtifactCard key={asset.id} artifact={asset} />
      ))}
    </>
  );
}
