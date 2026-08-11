/* Typed access to the component manifest @elirobinson/react publishes.
   Every consumer of component data — props tables, sidebar, search index, AI
   corpus — imports from here, and here reads the package. The docs site does
   not extract anything from packages/react/src itself: the manifest is built
   once, by the package that owns the components, and shipped in its dist. */

import manifest from '@elirobinson/react/manifest';

export type {
  ComponentRecord,
  HookRecord,
  PropRecord,
  SubComponentRecord,
} from '@elirobinson/react/manifest';

import type { ComponentRecord, HookRecord } from '@elirobinson/react/manifest';

/* Whatever directory names the package groups its components under. Not a
   fixed union: the manifest reports the layout it found, so a renamed or added
   tier reaches the site by bumping a version. */
export type Tier = string;

export const TIERS: Tier[] = manifest.tiers;
export const components: ComponentRecord[] = manifest.components;
export const hooks: HookRecord[] = manifest.hooks;

export function componentsByTier(tier: Tier): ComponentRecord[] {
  return components.filter((c) => c.tier === tier);
}

export function getComponent(slug: string): ComponentRecord | undefined {
  return components.find((c) => c.slug === slug);
}
