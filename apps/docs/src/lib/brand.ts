/* Typed access to the brand manifest @elirobinson/ai-patterns publishes —
   read exactly as manifest.ts reads the component one. The manifest is built
   by the package that owns the brand layer; this site is one more reader and
   derives nothing of its own from design-system-docs/. */

import brandManifest from '@elirobinson/ai-patterns/brand-manifest';
import type { BrandArtifact } from '@elirobinson/ai-patterns/brand-manifest';

export type { BrandArtifact };

export const brandArtifacts: BrandArtifact[] = brandManifest.artifacts;

/** Where scripts/stage-brand.mjs serves the real file from. */
export function brandFileUrl(path: string): string {
  return `/brand/${path}`;
}

/** Guideline cards in their @dsCard groups, in first-appearance order. */
export function guidelineCardGroups(): { group: string; cards: BrandArtifact[] }[] {
  const cards = brandArtifacts.filter((artifact) => artifact.category === 'guideline-card');
  const groups = [...new Set(cards.map((card) => card.group ?? 'Other'))];
  return groups.map((group) => ({
    group,
    cards: cards.filter((card) => (card.group ?? 'Other') === group),
  }));
}

export function brandAssets(): BrandArtifact[] {
  return brandArtifacts.filter((artifact) => artifact.category === 'asset');
}

/* Mirrored kits are manifested but never rendered: every entry point loads a
   _ds_bundle.js that was deliberately not copied, so each renders blank. The
   set is expected to shrink to zero as kits are ported — nothing here may
   hardcode its size. */
export function uiKits(): BrandArtifact[] {
  return brandArtifacts.filter(
    (artifact) => artifact.category === 'ui-kit' && artifact.origin !== 'mirrored',
  );
}

export function kitSlug(kit: BrandArtifact): string {
  return kit.id.split('/').pop() ?? kit.id;
}

export function getUiKit(slug: string): BrandArtifact | undefined {
  return uiKits().find((kit) => kitSlug(kit) === slug);
}

export function slideArtifacts(): BrandArtifact[] {
  return brandArtifacts.filter((artifact) => artifact.category === 'slide');
}

export function patternArtifacts(): BrandArtifact[] {
  return brandArtifacts.filter(
    (artifact) => artifact.category === 'pattern' && artifact.origin !== 'mirrored',
  );
}
