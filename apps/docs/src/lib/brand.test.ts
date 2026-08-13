import { describe, expect, it } from 'vitest';

import { brandArtifacts, getUiKit, guidelineCardGroups, kitSlug, uiKits } from './brand';

describe('brand manifest access', () => {
  it('reads a populated manifest', () => {
    expect(brandArtifacts.length).toBeGreaterThan(0);
  });

  it('lists only renderable kits — the mirrored ones render blank until ported', () => {
    const kits = uiKits();
    expect(kits.length).toBeGreaterThan(0);
    for (const kit of kits) {
      expect(kit.origin).not.toBe('mirrored');
      expect(kit.path.startsWith('_project-mirror/')).toBe(false);
    }
  });

  it('round-trips a kit through its slug', () => {
    for (const kit of uiKits()) {
      expect(getUiKit(kitSlug(kit))?.id).toBe(kit.id);
    }
  });

  it('groups every guideline card under a titled group', () => {
    const groups = guidelineCardGroups();
    expect(groups.length).toBeGreaterThan(0);
    const total = groups.reduce((sum, group) => sum + group.cards.length, 0);
    expect(total).toBe(brandArtifacts.filter((a) => a.category === 'guideline-card').length);
  });
});
