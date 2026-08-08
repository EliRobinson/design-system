/* Typed access to the generated component manifest. Every consumer of
   component data — props tables, search index, AI artifacts — imports from
   here, never from a hand-maintained copy. */

import manifestJson from '../generated/component-manifest.json';

export type PropRecord = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  description: string;
};

export type SubComponentRecord = {
  name: string;
  description: string;
  inherits: string | null;
  props: PropRecord[];
};

export type Tier = 'atoms' | 'molecules' | 'organisms';

export type ComponentRecord = {
  name: string;
  slug: string;
  tier: Tier;
  importPath: string;
  stylesheetPaths: string[];
  description: string;
  inherits: string | null;
  props: PropRecord[];
  subComponents: SubComponentRecord[];
  hooks: { name: string; description: string }[];
  exportedTypes: string[];
  constraints: string[];
  extractionGaps: string[];
};

export type HookRecord = {
  name: string;
  importPath: string;
  description: string;
};

export const TIERS: Tier[] = ['atoms', 'molecules', 'organisms'];

export const components = manifestJson.components as ComponentRecord[];
export const hooks = manifestJson.hooks as HookRecord[];

export function componentsByTier(tier: Tier): ComponentRecord[] {
  return components.filter((c) => c.tier === tier);
}

export function getComponent(slug: string): ComponentRecord | undefined {
  return components.find((c) => c.slug === slug);
}
