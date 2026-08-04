import { describe, expect, it } from 'vitest';
import { POOL_PACK } from '../../src/verticals/packs/pool';
import { resolvePackChecklistSections } from '../../src/verticals/checklistSections';

describe('resolvePackChecklistSections', () => {
  it('merges extension-gated templates onto the primary service checklist', () => {
    const sections = resolvePackChecklistSections(POOL_PACK, 'pool_visit');
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('Service');
    expect(titles).toContain('Readings');
    expect(sections.find((s) => s.title === 'Readings')?.items.every((i) => i.inputType === 'number')).toBe(
      true,
    );
  });

  it('returns empty when the primary key is unknown', () => {
    expect(resolvePackChecklistSections(POOL_PACK, 'missing')).toEqual([]);
  });
});
