/* Variants are extra mounts for the demo pages: a tool mid-run, a stream
   half-arrived, an empty state. The audit does not use them — it measures the
   default mount — so nothing else would notice a variant naming a component
   that no longer exists. This does.

   Imported through the published subpaths, `@elirobinson/ai-elements/manifest`
   and `@elirobinson/ai-elements/fixtures`, rather than relative paths into the
   package: what is checked here is the surface a consumer actually gets, and a
   subpath that stops resolving fails this test the same way it would fail
   their build. */
import { describe, expect, it } from 'vitest';

import manifest from '@elirobinson/ai-elements/manifest';
import { fixtures, variants } from '@elirobinson/ai-elements/fixtures';

const names = new Set(manifest.entries.map((entry) => entry.name));

describe('variants', () => {
  it('only name components the package actually ships', () => {
    for (const name of Object.keys(variants)) {
      expect(names.has(name), `variants has "${name}", which is not in the manifest`).toBe(true);
    }
  });

  it('only name components that already have a default mount', () => {
    /* A variant without a default is a demo page that renders a state of
       something the audit never measured. */
    for (const name of Object.keys(variants)) {
      expect(fixtures[name], `"${name}" has variants but no default fixture`).toBeDefined();
    }
  });

  it('give every variant a non-empty name', () => {
    for (const [name, group] of Object.entries(variants)) {
      expect(Object.keys(group).length, `"${name}" has an empty variant group`).toBeGreaterThan(0);
      for (const label of Object.keys(group)) {
        expect(label.trim().length, `"${name}" has a blank variant label`).toBeGreaterThan(0);
      }
    }
  });
});
